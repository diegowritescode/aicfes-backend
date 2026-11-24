import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Sending email, through Resend's HTTP API.
 *
 * No SDK: the API is one POST, and a dependency that wraps one POST
 * is a dependency to keep updated for nothing.
 *
 * **Log-only without a key**, the same shape Zyrcle uses. A server
 * configured without `RESEND_API_KEY` writes what it would have sent
 * and carries on — so a deploy that forgets the key loses the
 * notification and nothing else. Failing the request instead would
 * mean a learner's report is refused because an operator's mail is
 * misconfigured, which is the wrong thing to break.
 */
@Injectable()
export class CorreoService {
  private readonly log = new Logger(CorreoService.name);

  constructor(private readonly config: ConfigService) {}

  private get clave(): string | null {
    const v = this.config.get<string>('RESEND_API_KEY');
    return v && v.trim().length > 0 ? v.trim() : null;
  }

  private get remitente(): string {
    return (
      this.config.get<string>('CORREO_REMITENTE')?.trim() ||
      'AICFES <no-reply@aicfes.deviego.xyz>'
    );
  }

  get habilitado(): boolean {
    return this.clave !== null;
  }

  /**
   * Sends one email. Never throws.
   *
   * The caller is doing something else that matters more — recording
   * a report, for instance — and an unreachable mail provider must
   * not undo it.
   */
  async enviar(params: {
    para: string;
    asunto: string;
    texto: string;
  }): Promise<{ enviado: boolean; motivo?: string }> {
    const clave = this.clave;

    if (!clave) {
      this.log.warn(
        `Sin RESEND_API_KEY: no se envió "${params.asunto}" a ${params.para}.`,
      );
      return { enviado: false, motivo: 'SIN_CLAVE' };
    }

    try {
      /* Ten seconds. A mail provider that is slow must not hold a
         request a learner is waiting on. */
      const control = new AbortController();
      const temporizador = setTimeout(() => control.abort(), 10_000);

      const respuesta = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${clave}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.remitente,
          to: [params.para],
          subject: params.asunto,
          text: params.texto,
        }),
        signal: control.signal,
      });

      clearTimeout(temporizador);

      if (!respuesta.ok) {
        /* The body is read for the log and not returned: it can carry
           the address, and this string ends up in a response. */
        const detalle = await respuesta.text().catch(() => '');
        this.log.error(`Resend respondió ${respuesta.status}: ${detalle.slice(0, 200)}`);
        return { enviado: false, motivo: `HTTP_${respuesta.status}` };
      }

      return { enviado: true };
    } catch (error) {
      this.log.error(`No se pudo enviar el correo: ${String(error)}`);
      return { enviado: false, motivo: 'ERROR_DE_RED' };
    }
  }
}
