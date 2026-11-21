import { Controller, Get, Header, NotFoundException, Param, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { PrismaService } from '../persistence/prisma.service';
import { DESCRIPCIONES, IDS_PLANTILLA, describirFigura, dibujarFigura, validarFigura } from './registro';
import type { FiguraSpec } from './types';

/**
 * Serves an item's figure as SVG.
 *
 * Drawn on request rather than stored as an image: the item keeps the
 * numbers, so correcting a template corrects every item that uses it,
 * and nothing has to be regenerated.
 */
@Controller('figuras')
@ApiTags('Figuras')
export class FigurasController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('plantillas')
  @ApiOperation({ summary: 'The templates a figure can use' })
  plantillas() {
    return {
      ok: true,
      data: IDS_PLANTILLA.map((id) => ({ id, descripcion: DESCRIPCIONES[id] })),
    };
  }

  @Get('item/:id.svg')
  @ApiOperation({ summary: "Draw an item's figure" })
  @ApiResponse({ status: 200, description: 'The figure, as SVG.' })
  @ApiResponse({ status: 404, description: 'The item has no figure.' })
  @Header('Content-Type', 'image/svg+xml; charset=utf-8')
  // The drawing is a pure function of the item's stored numbers, so it
  // can be cached hard; a changed template changes the item's version.
  @Header('Cache-Control', 'public, max-age=86400')
  async svg(@Param('id') id: string, @Res({ passthrough: true }) _res: Response): Promise<string> {
    const item = await this.prisma.generatedItem.findUnique({
      where: { id },
      select: { figura: true },
    });
    if (!item?.figura) throw new NotFoundException('Este ítem no tiene figura');

    const spec = item.figura as unknown as FiguraSpec;
    // Stored data is still checked: a template may have tightened its
    // rules since the item was written.
    const validacion = validarFigura(spec);
    if (!validacion.valida) {
      throw new NotFoundException(`La figura no se puede dibujar: ${validacion.error}`);
    }
    return dibujarFigura(spec);
  }

  @Get('item/:id/alt')
  @ApiOperation({ summary: 'The text alternative to the figure' })
  async alt(@Param('id') id: string) {
    const item = await this.prisma.generatedItem.findUnique({
      where: { id },
      select: { figura: true },
    });
    if (!item?.figura) throw new NotFoundException('Este ítem no tiene figura');
    return { ok: true, data: { alt: describirFigura(item.figura as unknown as FiguraSpec) } };
  }
}

export default FigurasController;
