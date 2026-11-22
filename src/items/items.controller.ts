import { SesionRequeridaGuard } from '../common/guards/sesion-requerida.guard';
import { CuotaGuard } from '../common/guards/cuota.guard';
import { Controller, Post, Body, Req, Get, Query, Param, Delete, HttpException, HttpStatus, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { GenerateRequestSchema } from './dto/generate-request.schema';
import { GenerateMixedSchema } from './dto/generate-mixed.schema';
import { ItemGeneratorService } from './services/item-generator.service';
import { ConfigService } from '@nestjs/config';
import { PersistenceService } from '../persistence/persistence.service';
import { ItemBankService } from './services/item-bank.service';
import { nanoid } from 'nanoid';
import { DashboardService } from '../dashboard/dashboard.service';

/**
 * Controlador de generación de ítems ICFES
 * Endpoints:
 * - POST /items/generate: generar nuevos ítems
 * - GET /items: listar ítems generados
 * - GET /items/requests: listar requests de generación
 */
@Controller('items')
@ApiTags('Items')
export class ItemsController {
  // Simple in-memory rate limiter: map key -> lastTimestamp(ms)
  // Key format: `${ip}:${endpoint}`
  private static rateLimitMap: Map<string, number> = new Map();

  private checkRateLimit(ip: string, endpoint: string, windowMs: number = 100) {
    const key = `${ip}:${endpoint}`;
    const now = Date.now();
    const last = ItemsController.rateLimitMap.get(key) || 0;
    if (now - last < windowMs) {
      return false;
    }
    ItemsController.rateLimitMap.set(key, now);
    return true;
  }
  constructor(
    private generator: ItemGeneratorService,
    private config: ConfigService,
    private persistence: PersistenceService,
    private bank: ItemBankService,
    private dashboardService: DashboardService
  ) {}

  private pickString(value: unknown) {
    if (Array.isArray(value)) {
      return value[0];
    }

    return typeof value === 'string' ? value : undefined;
  }

  private getUserId(req: any) {
    // The token is the only trustworthy source. A header, query or
    // body field is supplied by the caller, so accepting any of them
    // let anyone read and write another learner's data.
    const candidate = this.pickString(req?.userId);
    return candidate && candidate.trim() ? candidate.trim() : null;
  }

  /**
   * POST /api/items/generate
   * Genera nuevos ítems ICFES con respuesta normalizada
   */
  @UseGuards(SesionRequeridaGuard, CuotaGuard)
  @Post('generate')
  @ApiOperation({
    summary: 'Generar ítems de examen ICFES',
    description:
      'Genera nuevos ítems de examen usando IA. Retorna respuesta normalizada con validación estricta. ' +
      'Los ítems se validan contra esquema Zod, límites de longitud ICFES y tipos de distractor por área.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['area', 'dificultad', 'n'],
      properties: {
        area: {
          type: 'string',
          enum: ['MAT', 'LC', 'CN', 'SOC', 'ING'],
          description: 'Área del conocimiento (MAT=Matemáticas, LC=Lenguaje y Comunicación, etc.)',
        },
        dificultad: {
          type: 'string',
          enum: ['facil', 'media', 'alta'],
          description: 'Nivel de dificultad del ítem',
        },
        n: {
          type: 'number',
          description: 'Cantidad de ítems a generar (máx 100, default 1)',
          example: 5,
        },
        tema: {
          type: 'string',
          description: 'Tema específico (ej: "división de números")',
        },
        plantilla: {
          type: 'string',
          description: 'Instrucción especial para el ítem',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Respuesta normalizada con ítems generados',
    schema: {
      type: 'object',
      properties: {
        ok: { type: 'boolean' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              area: { type: 'string' },
              dificultad: { type: 'string' },
              plantilla: { type: 'string' },
              contexto: { type: 'string' },
              pregunta: { type: 'string' },
              opciones: { type: 'object' },
              respuesta_correcta: { type: 'string' },
              justificacion: { type: 'string' },
              tags: { type: 'array', items: { type: 'string' } },
              distractores: { type: 'object' },
              explicaciones: {
                type: 'object',
                properties: {
                  A: { type: 'string' },
                  B: { type: 'string' },
                  C: { type: 'string' },
                  D: { type: 'string' },
                },
              },
            },
          },
        },
        meta: {
          type: 'object',
          properties: {
            requestId: { type: 'string' },
            area: { type: 'string' },
            dificultad: { type: 'string' },
            n: { type: 'number' },
            model: { type: 'string' },
          },
        },
        error: { type: 'object' },
      },
    },
  })
  async generate(@Body() body: any, @Req() req: any) {
    // Obtener requestId del middleware
    let requestId = req.requestId;
    if (!requestId) {
      requestId = nanoid();
      req.requestId = requestId;
    }

    console.log(`[${requestId}] POST /items/generate`, { area: body.area, n: body.n });

    // Validar input
    const parsed = GenerateRequestSchema.safeParse(body);
    if (!parsed.success) {
      console.error(`[${requestId}] Validation error:`, parsed.error.errors);
      await this.persistence.markGenerationError(
        requestId,
        `Validation error: ${JSON.stringify(parsed.error.errors)}`
      );
      
      return {
        ok: false,
        items: [],
        meta: {
          requestId,
          area: body.area,
          dificultad: body.dificultad,
          n: body.n || 1,
          model: this.config.get('OPENAI_MODEL'),
        },
        error: {
          code: 'VALIDATION_ERROR',
          message: JSON.stringify(parsed.error.errors),
        },
      };
    }

    const maxItems = Number(this.config.get('MAX_ITEMS') || 100);
    let n = parsed.data.n === undefined ? 1 : parsed.data.n;
    if (n > maxItems) n = maxItems;

    try {
      console.log(`[${requestId}] Creating generation request`);

      // Crear request en BD
      await this.persistence.createGenerationRequest({
        requestId,
        area: parsed.data.area as any,
        dificultad: parsed.data.dificultad as any,
        tema: parsed.data.tema,
        plantilla: parsed.data.plantilla,
        n,
      });

      console.log(`[${requestId}] Calling ItemGeneratorService`);

      // Generar ítems
      const result = await this.generator.generate(
        {
          area: parsed.data.area,
          dificultad: parsed.data.dificultad,
          tema: parsed.data.tema,
          plantilla: parsed.data.plantilla,
          n,
        },
        requestId
      );

      console.log(
        `[${requestId}] Generation complete - ${result.items.length} valid items, parseStatus=${result.parseStatus}`
      );

      // Si no hay ítems válidos, retornar error
      if (result.items.length === 0) {
        console.warn(`[${requestId}] No valid items generated`);
        await this.persistence.markGenerationError(
          requestId,
          result.parseError || 'No valid items generated',
          result.rawModelOutput
        );

        return {
          ok: false,
          items: [],
          meta: {
            requestId,
            area: parsed.data.area,
            dificultad: parsed.data.dificultad,
            tema: parsed.data.tema,
            n,
            model: this.config.get('OPENAI_MODEL'),
          },
          error: {
            code: 'GENERATION_FAILED',
            message: result.parseError || 'No valid items generated',
            raw: result.rawModelOutput?.substring(0, 200),
          },
        };
      }

      // Guardar en BD
      console.log(`[${requestId}] Saving ${result.items.length} items to database`);
      const saved = await this.persistence.saveGeneratedItems({
        requestId,
        items: result.items,
        rawModelOutput: result.rawModelOutput,
        parseStatus: result.parseStatus,
        parseError: result.parseError,
      });

      // Indexing needs an embedding request per item, so it runs after
      // the response is on its way rather than making the caller wait.
      void Promise.all(
        saved.map((row, i) =>
          result.items[i] ? this.bank.indexItem(row.id, result.items[i]) : undefined,
        ),
      ).catch((error) => console.warn(`[${requestId}] indexing failed:`, error));

      console.log(`[${requestId}] Successfully completed generation`);

      // Respuesta exitosa (SIEMPRE array, nunca objeto)
      return {
        ok: true,
        items: result.items,
        meta: {
          requestId,
          area: parsed.data.area,
          dificultad: parsed.data.dificultad,
          tema: parsed.data.tema,
          plantilla: parsed.data.plantilla,
          n: result.items.length,
          model: this.config.get('OPENAI_MODEL'),
        },
      };
    } catch (error) {
      console.error(`[${requestId}] Error during generation:`, error);
      await this.persistence.markGenerationError(
        requestId,
        error.message || 'Unknown error'
      );

      return {
        ok: false,
        items: [],
        meta: {
          requestId,
          area: parsed.data.area,
          dificultad: parsed.data.dificultad,
          n: body.n || 1,
          model: this.config.get('OPENAI_MODEL'),
        },
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message || 'Unknown error',
        },
      };
    }
  }

  /**
   * POST /api/items/generate-mixed
   * Genera un set mixto de ítems por área/dificultad
   */
  @UseGuards(SesionRequeridaGuard, CuotaGuard)
  @Post('generate-mixed')
  @ApiOperation({
    summary: 'Generar ítems mixtos por secciones',
    description:
      'Permite armar una prueba con múltiples secciones (área + dificultad + n). ' +
      'Devuelve una lista combinada de ítems con opción de barajar.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['sections'],
      properties: {
        sections: {
          type: 'array',
          items: {
            type: 'object',
            required: ['area', 'dificultad', 'n'],
            properties: {
              area: { type: 'string', enum: ['MAT', 'LC', 'CN', 'SOC', 'ING'] },
              dificultad: { type: 'string', enum: ['facil', 'media', 'alta'] },
              n: { type: 'number' },
              tema: { type: 'string' },
              plantilla: { type: 'string' },
            },
          },
        },
        shuffle: { type: 'boolean', default: true },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Respuesta normalizada con ítems combinados',
  })
  async generateMixed(@Body() body: any, @Req() req: any) {
    let batchRequestId = req.requestId;
    if (!batchRequestId) {
      batchRequestId = nanoid();
      req.requestId = batchRequestId;
    }

    const parsed = GenerateMixedSchema.safeParse(body);
    if (!parsed.success) {
      return {
        ok: false,
        items: [],
        meta: {
          requestId: batchRequestId,
        },
        error: {
          code: 'VALIDATION_ERROR',
          message: JSON.stringify(parsed.error.errors),
        },
      };
    }

    const maxItems = Number(this.config.get('MAX_ITEMS') || 100);
    const totalRequested = parsed.data.sections.reduce((sum, section) => sum + section.n, 0);
    if (totalRequested > maxItems) {
      return {
        ok: false,
        items: [],
        meta: {
          requestId: batchRequestId,
          totalRequested,
          maxItems,
        },
        error: {
          code: 'MAX_ITEMS_EXCEEDED',
          message: `Total requested (${totalRequested}) exceeds MAX_ITEMS (${maxItems}).`,
        },
      };
    }

    const sectionsMeta: Array<{
      requestId: string;
      area: string;
      dificultad: string;
      n: number;
      generated: number;
      error?: string;
    }> = [];

    const allItems: any[] = [];
    let sessionMeta: { sessionId: string; startedAt: string } | null = null;

    if (parsed.data.session?.create) {
      const userId = this.getUserId(req);
      if (!userId) {
        return {
          ok: false,
          items: [],
          meta: { requestId: batchRequestId },
          error: {
            code: 'USER_ID_REQUIRED',
            message: 'Send Authorization header or X-User-Id to create a session.',
          },
        };
      }

      const firstSection = parsed.data.sections[0];
      const startedAt = parsed.data.session.startedAt || new Date().toISOString();
      const mode = parsed.data.session.mode || 'generacion_libre';
      sessionMeta = await this.dashboardService.startStudySession(userId, {
        userId,
        timezone: parsed.data.session.timezone,
        mode,
        area: firstSection.area,
        dificultad: firstSection.dificultad,
        tema: firstSection.tema,
        startedAt,
      });

      if (parsed.data.session.seedAreaSummary !== false) {
        const areaSummaryMap = new Map<string, { area: string; totalQuestions: number; correctQuestions: number }>();
        for (const section of parsed.data.sections) {
          const entry = areaSummaryMap.get(section.area) || {
            area: section.area,
            totalQuestions: 0,
            correctQuestions: 0,
          };
          entry.totalQuestions += section.n;
          areaSummaryMap.set(section.area, entry);
        }

        const areaSummary = Array.from(areaSummaryMap.values());
        await this.dashboardService.applySessionAreaSummary({
          userId,
          sessionId: sessionMeta.sessionId,
          areaSummary: areaSummary as any,
        });
      }
    }

    for (const section of parsed.data.sections) {
      const sectionRequestId = nanoid();
      try {
        await this.persistence.createGenerationRequest({
          requestId: sectionRequestId,
          area: section.area as any,
          dificultad: section.dificultad as any,
          tema: section.tema,
          plantilla: section.plantilla,
          n: section.n,
        });

        const result = await this.generator.generate(
          {
            area: section.area,
            dificultad: section.dificultad,
            tema: section.tema,
            plantilla: section.plantilla,
            n: section.n,
          },
          sectionRequestId,
        );

        if (result.items.length === 0) {
          await this.persistence.markGenerationError(
            sectionRequestId,
            result.parseError || 'No valid items generated',
            result.rawModelOutput,
          );
          sectionsMeta.push({
            requestId: sectionRequestId,
            area: section.area,
            dificultad: section.dificultad,
            n: section.n,
            generated: 0,
            error: result.parseError || 'No valid items generated',
          });
          continue;
        }

        await this.persistence.saveGeneratedItems({
          requestId: sectionRequestId,
          items: result.items,
          rawModelOutput: result.rawModelOutput,
          parseStatus: result.parseStatus,
          parseError: result.parseError,
        });

        allItems.push(...result.items);
        sectionsMeta.push({
          requestId: sectionRequestId,
          area: section.area,
          dificultad: section.dificultad,
          n: section.n,
          generated: result.items.length,
        });
      } catch (error) {
        await this.persistence.markGenerationError(
          sectionRequestId,
          error.message || 'Unknown error',
        );
        sectionsMeta.push({
          requestId: sectionRequestId,
          area: section.area,
          dificultad: section.dificultad,
          n: section.n,
          generated: 0,
          error: error.message || 'Unknown error',
        });
      }
    }

    if (parsed.data.shuffle) {
      for (let i = allItems.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [allItems[i], allItems[j]] = [allItems[j], allItems[i]];
      }
    }

    const ok = allItems.length > 0;

    return {
      ok,
      items: allItems,
      meta: {
        requestId: batchRequestId,
        totalRequested,
        totalGenerated: allItems.length,
        sections: sectionsMeta,
        shuffle: parsed.data.shuffle,
        session: sessionMeta,
      },
      error: ok
        ? undefined
        : {
            code: 'GENERATION_FAILED',
            message: 'No valid items generated for any section.',
          },
    };
  }

  /**
   * GET /api/items
   * Lista ítems generados con filtros opcionales
   */
  @Get()
  @ApiOperation({
    summary: 'Listar ítems generados',
    description:
      'Lista ítems que han sido generados exitosamente. ' +
      'Use ?area=MAT para filtrar por área específica.',
  })
  @ApiQuery({
    name: 'area',
    required: false,
    enum: ['MAT', 'LC', 'CN', 'SOC', 'ING'],
    description: 'Filtrar por área del conocimiento',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Máximo número de ítems a retornar (máx 500)',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de ítems',
    schema: {
      type: 'object',
      properties: {
        ok: { type: 'boolean' },
        items: { type: 'array' },
        meta: { type: 'object' },
      },
    },
  })
  async listItems(@Query('area') area?: string, @Query('limit') limitStr?: string) {
    const limit = Math.min(parseInt(limitStr || '100'), 500);

    if (area) {
      const items = await this.persistence.getGeneratedItemsByArea(area as any, limit);
      return {
        ok: true,
        items,
        meta: {
          count: items.length,
          area,
        },
      };
    }

    // Si no hay filtro, retornar mensaje
    return {
      ok: true,
      items: [],
      meta: {
        message: 'Use ?area=MAT (or LC, CN, SOC, ING) to filter',
      },
    };
  }

  /**
   * GET /api/items/requests
   * Lista requests de generación (para debugging)
   */
  @Get('requests')
  @ApiOperation({
    summary: 'Listar requests de generación',
    description:
      'Retorna estadísticas de requests de generación para debugging. ' +
      'Muestra cantidad de ítems solicitados vs generados vs normalizados.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Máximo número de requests a retornar (máx 500)',
  })
  @ApiResponse({
    status: 200,
    description: 'Estadísticas de requests',
    schema: {
      type: 'object',
      properties: {
        ok: { type: 'boolean' },
        requests: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              requestId: { type: 'string' },
              area: { type: 'string' },
              status: { type: 'string' },
              parseStatus: { type: 'string' },
              itemsRequested: { type: 'number' },
              itemsGenerated: { type: 'number' },
              normalizedCount: { type: 'number' },
              hasParseError: { type: 'boolean' },
              createdAt: { type: 'string' },
            },
          },
        },
        meta: { type: 'object' },
      },
    },
  })
  async listRequests(@Query('limit') limitStr?: string) {
    const limit = Math.min(parseInt(limitStr || '50'), 500);
    const stats = await this.persistence.getRequestsWithStats(limit);

    return {
      ok: true,
      requests: stats,
      meta: {
        count: stats.length,
      },
    };
  }

  /**
   * GET /api/items/requests/failed
   * Lista requests con errores de parsing (para debugging admin)
   */
  @Get('requests/failed')
  @ApiOperation({
    summary: 'Listar requests con errores (Admin)',
    description:
      'Endpoint de debugging para admin. Retorna requests que fallaron en parsing con salida cruda del modelo. ' +
      'Útil para auditoría y análisis de errores.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Máximo número de requests fallidos a retornar (máx 100)',
  })
  @ApiResponse({
    status: 200,
    description: 'Requests con errores de parsing',
    schema: {
      type: 'object',
      properties: {
        ok: { type: 'boolean' },
        failedRequests: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              requestId: { type: 'string' },
              area: { type: 'string' },
              parseStatus: { type: 'string' },
              parseError: { type: 'string' },
              rawModelOutput: { type: 'string' },
              items: { type: 'array' },
            },
          },
        },
        meta: { type: 'object' },
      },
    },
  })
  async listFailedRequests(@Query('limit') limitStr?: string) {
    const limit = Math.min(parseInt(limitStr || '20'), 100);
    const failed = await this.persistence.getFailedParsingRequests(limit);

    return {
      ok: true,
      failedRequests: failed,
      meta: {
        count: failed.length,
      },
    };
  }

  /**
   * GET /api/items/requests/:requestId/status
   * Devuelve estado y métricas del request de generación
   */
  @Get('requests/:requestId/status')
  @ApiOperation({ summary: 'Get generation request status', description: 'Returns the current status and metrics for a generation request.' })
  @ApiParam({ name: 'requestId', description: 'Request ID returned in meta.requestId from /items/generate' })
  async getRequestStatus(@Param('requestId') requestId: string, @Req() request: any) {
    // Basic requestId validation
    if (!requestId || requestId.length < 4) {
      throw new HttpException({ code: 'INVALID_REQUEST_ID', message: 'requestId too short' }, HttpStatus.BAD_REQUEST);
    }

    // Rate limit per IP
    const ip = request.ip || (request.headers && (request.headers['x-forwarded-for'] || request.connection?.remoteAddress)) || 'unknown';
    if (!this.checkRateLimit(ip, 'status')) {
      throw new HttpException({ code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' }, HttpStatus.TOO_MANY_REQUESTS);
    }

    const req = await this.persistence.getGenerationRequest(requestId);
    if (!req) {
      throw new HttpException({ code: 'REQUEST_NOT_FOUND', message: 'Request not found' }, HttpStatus.NOT_FOUND);
    }

    // Expiry: do not disclose requests older than 24h
    const ageMs = Date.now() - new Date(req.createdAt).getTime();
    const TTL = 24 * 3600 * 1000;
    if (ageMs > TTL) {
      throw new HttpException({ code: 'REQUEST_EXPIRED', message: 'Request expired' }, HttpStatus.NOT_FOUND);
    }

    // Map DB status to API-friendly status
    let status: string;
    if (req.error === 'CANCELLED') {
      status = 'cancelled';
    } else if (req.status === 'PENDING') {
      // If some items already normalized, consider it generating
      status = req.normalizedItemsCount && req.normalizedItemsCount > 0 ? 'generating' : 'pending';
    } else if (req.status === 'SUCCESS') {
      status = 'completed';
    } else {
      status = 'failed';
    }

    const itemsGenerated = req.items ? req.items.length : 0;
    const itemsRequested = req.n || 0;
    const progress = itemsRequested > 0 ? Math.round((itemsGenerated / itemsRequested) * 100) : 0;

    // Estimate remaining seconds using elapsed time per generated item
    let estimatedRemainingSeconds: number | null = null;
    if (itemsGenerated > 0 && status === 'generating') {
      const now = new Date();
      const startedAt = req.createdAt || new Date();
      const elapsedSeconds = Math.max(1, Math.floor((now.getTime() - startedAt.getTime()) / 1000));
      const avgPerItem = elapsedSeconds / Math.max(1, itemsGenerated);
      estimatedRemainingSeconds = Math.round((itemsRequested - itemsGenerated) * avgPerItem);
    }

    return {
      ok: true,
      requestId: req.requestId,
      status,
      progress,
      itemsRequested,
      itemsGenerated,
      estimatedRemainingSeconds,
      startedAt: req.createdAt,
      updatedAt: req.updatedAt,
      error: req.error || null,
    };
  }

  /**
   * GET /api/items/requests/:requestId
   * Si el request está completado devuelve los items generados
   */
  @Get('requests/:requestId')
  @ApiOperation({ summary: 'Get generation request details', description: 'If completed, returns generated items. Otherwise returns metadata and status.' })
  @ApiParam({ name: 'requestId' })
  async getRequest(@Param('requestId') requestId: string, @Req() request: any) {
    // Basic validation
    if (!requestId || requestId.length < 4) {
      throw new HttpException({ code: 'INVALID_REQUEST_ID', message: 'requestId too short' }, HttpStatus.BAD_REQUEST);
    }

    // Rate limit per IP
    const ip = request.ip || (request.headers && (request.headers['x-forwarded-for'] || request.connection?.remoteAddress)) || 'unknown';
    if (!this.checkRateLimit(ip, 'getRequest')) {
      throw new HttpException({ code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' }, HttpStatus.TOO_MANY_REQUESTS);
    }

    const req = await this.persistence.getGenerationRequest(requestId);
    if (!req) {
      throw new HttpException({ code: 'REQUEST_NOT_FOUND', message: 'Request not found' }, HttpStatus.NOT_FOUND);
    }

    // Expiry: do not disclose requests older than 24h
    const ageMs = Date.now() - new Date(req.createdAt).getTime();
    const TTL = 24 * 3600 * 1000;
    if (ageMs > TTL) {
      throw new HttpException({ code: 'REQUEST_EXPIRED', message: 'Request expired' }, HttpStatus.NOT_FOUND);
    }

    const isCompleted = req.status === 'SUCCESS' && (!req.error || req.error !== 'CANCELLED');
    if (isCompleted) {
      return {
        ok: true,
        requestId: req.requestId,
        status: 'completed',
        items: req.items || [],
      };
    }

    // Otherwise return status summary
    const itemsGenerated = req.items ? req.items.length : 0;
    return {
      ok: true,
      requestId: req.requestId,
      status: req.error === 'CANCELLED' ? 'cancelled' : req.status === 'PENDING' ? 'pending' : 'failed',
      itemsGenerated,
      items: isCompleted ? req.items : undefined,
    };
  }

  /**
   * DELETE /api/items/requests/:requestId/cancel
   * Cancela un request en curso (marca como cancelled)
   */
  @Delete('requests/:requestId/cancel')
  @ApiOperation({ summary: 'Cancel generation request', description: 'Cancel a pending or generating request.' })
  @ApiParam({ name: 'requestId' })
  async cancelRequest(@Param('requestId') requestId: string, @Req() request: any) {
    // Validation
    if (!requestId || requestId.length < 4) {
      throw new HttpException({ code: 'INVALID_REQUEST_ID', message: 'requestId too short' }, HttpStatus.BAD_REQUEST);
    }

    // Rate limit per IP
    const ip = request.ip || (request.headers && (request.headers['x-forwarded-for'] || request.connection?.remoteAddress)) || 'unknown';
    if (!this.checkRateLimit(ip, 'cancel')) {
      throw new HttpException({ code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' }, HttpStatus.TOO_MANY_REQUESTS);
    }

    const req = await this.persistence.getGenerationRequest(requestId);
    if (!req) {
      throw new HttpException({ code: 'REQUEST_NOT_FOUND', message: 'Request not found' }, HttpStatus.NOT_FOUND);
    }

    // Expiry: cannot cancel after 24h
    const ageMs = Date.now() - new Date(req.createdAt).getTime();
    const TTL = 24 * 3600 * 1000;
    if (ageMs > TTL) {
      throw new HttpException({ code: 'REQUEST_EXPIRED', message: 'Request expired' }, HttpStatus.NOT_FOUND);
    }

    const isStillGenerating = req.status === 'PENDING' || (req.normalizedItemsCount && req.normalizedItemsCount < req.n);
    if (!isStillGenerating) {
      return {
        ok: false,
        code: 'CANNOT_CANCEL',
        message: 'Request already completed or failed',
      };
    }

    await this.persistence.markRequestCancelled(requestId);

    return {
      ok: true,
      data: { status: 'cancelled' },
    };
  }
}
