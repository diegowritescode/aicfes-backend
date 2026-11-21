import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { Area, Dificultad, GenerationStatus, ParseStatus } from '@prisma/client';
import { hashQuestion } from '../common/question-hash';
import { Item } from '../items/schemas/item.schema';

@Injectable()
export class PersistenceService {
  constructor(private prisma: PrismaService) {}

  async createGenerationRequest(params: {
    requestId: string;
    area: Area;
    dificultad: Dificultad;
    tema?: string;
    plantilla?: string;
    n: number;
  }) {
    return this.prisma.generationRequest.create({
      data: {
        requestId: params.requestId,
        area: params.area,
        dificultad: params.dificultad,
        tema: params.tema || null,
        plantilla: params.plantilla || null,
        n: params.n,
        status: GenerationStatus.PENDING,
      },
    });
  }

  /**
   * Guarda los ítems generados en BD
   * También guarda rawModelOutput, parseStatus y metadata de validación
   */
  async saveGeneratedItems(params: {
    requestId: string;
    items: Item | Item[];
    rawModelOutput?: string;
    parseStatus?: 'OK' | 'FAIL';
    parseError?: string;
  }) {
    const { requestId, items, rawModelOutput, parseStatus, parseError } = params;
    const itemsArray = Array.isArray(items) ? items : [items];

    const createdItems = await Promise.all(
      itemsArray.map((item) =>
        this.prisma.generatedItem.create({
          data: {
            requestId,
            area: item.area as Area,
            dificultad: item.dificultad as Dificultad,
            plantilla: item.plantilla,
            contexto: item.contexto,
            pregunta: item.pregunta,
            opciones: item.opciones,
            respuesta_correcta: item.respuesta_correcta,
            justificacion: item.justificacion,
            tags: item.tags,
            distractores: item.distractores,
            explicaciones: item.explicaciones,
            // Everything reaching this point has been solved
            // independently and agreed with, so it belongs in the bank.
            verified: true,
            questionHash: hashQuestion(item.contexto, item.pregunta),
          },
        })
      )
    );

    // Update generation request status and debug info
    await this.prisma.generationRequest.update({
      where: { requestId },
      data: {
        status: itemsArray.length > 0 ? GenerationStatus.SUCCESS : GenerationStatus.ERROR,
        rawModelOutput: rawModelOutput || null,
        parseStatus: parseStatus as ParseStatus,
        parseError: parseError || null,
        normalizedItemsCount: itemsArray.length,
      },
    });

    return createdItems;
  }

  async markGenerationError(requestId: string, error: string, rawOutput?: string) {
    return this.prisma.generationRequest.update({
      where: { requestId },
      data: {
        status: GenerationStatus.ERROR,
        error,
        rawModelOutput: rawOutput || null,
        parseStatus: 'FAIL' as ParseStatus,
        parseError: error,
      },
    });
  }

  async markRequestCancelled(requestId: string) {
    return this.prisma.generationRequest.update({
      where: { requestId },
      data: {
        status: GenerationStatus.ERROR,
        error: 'CANCELLED',
        parseStatus: 'FAIL' as ParseStatus,
        parseError: 'Cancelled by user',
      },
    });
  }

  async getGenerationRequest(requestId: string) {
    return this.prisma.generationRequest.findUnique({
      where: { requestId },
      include: { items: true },
    });
  }

  async listGenerationRequests(limit: number = 50, offset: number = 0) {
    return this.prisma.generationRequest.findMany({
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    });
  }

  async getGeneratedItemsByArea(area: Area, limit: number = 100) {
    return this.prisma.generatedItem.findMany({
      where: { area },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Obtiene requests con errores de parsing (para debugging)
   */
  async getFailedParsingRequests(limit: number = 20) {
    return this.prisma.generationRequest.findMany({
      where: { parseStatus: 'FAIL' as ParseStatus },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    });
  }

  /**
   * Obtiene requests con análisis de éxito/fallo
   */
  async getRequestsWithStats(limit: number = 50) {
    const requests = await this.prisma.generationRequest.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          select: { id: true },
        },
      },
    });

    return requests.map((req) => ({
      requestId: req.requestId,
      area: req.area,
      dificultad: req.dificultad,
      status: req.status,
      parseStatus: req.parseStatus,
      itemsRequested: req.n,
      itemsGenerated: req.items.length,
      normalizedCount: req.normalizedItemsCount,
      hasParseError: !!req.parseError,
      createdAt: req.createdAt,
    }));
  }
}

