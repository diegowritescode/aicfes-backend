import { Controller, Post, Body, Req, Get, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { GenerateRequestSchema } from './dto/generate-request.schema';
import { ItemGeneratorService } from './services/item-generator.service';
import { ConfigService } from '@nestjs/config';
import { PersistenceService } from '../persistence/persistence.service';
import { nanoid } from 'nanoid';

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
  constructor(
    private generator: ItemGeneratorService,
    private config: ConfigService,
    private persistence: PersistenceService
  ) {}

  /**
   * POST /api/items/generate
   * Genera nuevos ítems ICFES con respuesta normalizada
   */
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
      await this.persistence.saveGeneratedItems({
        requestId,
        items: result.items,
        rawModelOutput: result.rawModelOutput,
        parseStatus: result.parseStatus,
        parseError: result.parseError,
      });

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
}

