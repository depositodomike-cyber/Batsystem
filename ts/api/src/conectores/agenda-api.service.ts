import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { OauthProviderService } from './oauth-provider.service';
import { getProviderJson } from './provider-fetch';

/**
 * Um evento da agenda, já normalizado — mesmo contrato para qualquer
 * provedor de calendário (hoje só o Google Calendar), então a UI não sabe
 * de onde veio o evento.
 */
export interface AgendaEvento {
  id: string;
  titulo: string;
  descricao?: string;
  local?: string;
  /** ISO 8601. Em evento de dia inteiro é a meia-noite local do dia. */
  inicio: string;
  fim: string;
  diaInteiro: boolean;
  organizador?: string;
  participantes?: { email: string; nome?: string; confirmacao?: string }[];
  /** Link do evento no calendário do provedor. */
  link?: string;
  /** Sala virtual (Meet/Hangouts), quando o evento tem uma. */
  reuniaoUrl?: string;
  /** Evento cancelado continua na listagem do provedor por um tempo. */
  cancelado?: boolean;
}

/** Teto de eventos por requisição (o provedor pagina acima disso). */
const LIMITE_MAX = 100;
const LIMITE_PADRAO = 25;

interface GoogleEvent {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  hangoutLink?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  organizer?: { email?: string; displayName?: string };
  attendees?: {
    email?: string;
    displayName?: string;
    responseStatus?: string;
  }[];
  conferenceData?: {
    entryPoints?: { uri?: string; entryPointType?: string }[];
  };
}

/** Rótulo em português do RSVP do convidado. */
const CONFIRMACAO: Record<string, string> = {
  accepted: 'Confirmado',
  declined: 'Recusado',
  tentative: 'Talvez',
  needsAction: 'Sem resposta',
};

/**
 * Leitura da agenda real do tenant, usando o token OAuth já guardado pelo
 * OauthProviderService (que renova sozinho quando expira). Mesmo desenho do
 * EmailApiService — só muda a API do outro lado.
 */
@Injectable()
export class AgendaApiService {
  private readonly logger = new Logger(AgendaApiService.name);

  constructor(private readonly oauth: OauthProviderService) {}

  /**
   * Próximos eventos do calendário principal, do mais próximo ao mais
   * distante. `singleEvents` expande as séries recorrentes em ocorrências —
   * é o que a agenda mostra.
   */
  async listUpcoming(
    empresaId: string,
    provedor: string,
    limite = LIMITE_PADRAO,
  ): Promise<AgendaEvento[]> {
    const max = Math.min(
      Math.max(1, Math.trunc(limite) || LIMITE_PADRAO),
      LIMITE_MAX,
    );
    const token = await this.oauth.getAccessToken(
      empresaId,
      provedor,
      'agenda',
    );
    if (provedor === 'google-calendar') return this.listGoogle(token, max);
    // Provedor desconhecido já falha em getAccessToken; guarda de tipo.
    throw new BadRequestException(`Provedor "${provedor}" não lê agenda.`);
  }

  private async listGoogle(
    token: string,
    max: number,
  ): Promise<AgendaEvento[]> {
    const params = new URLSearchParams({
      timeMin: new Date().toISOString(),
      maxResults: String(max),
      singleEvents: 'true',
      orderBy: 'startTime',
    });
    const data = await getProviderJson<{ items?: GoogleEvent[] }>(
      { logger: this.logger, label: 'Google Calendar', recurso: 'à agenda' },
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
      token,
    );
    return (data.items ?? []).map((e) => this.mapGoogle(e));
  }

  private mapGoogle(e: GoogleEvent): AgendaEvento {
    // `date` (sem hora) = dia inteiro; `dateTime` já vem com offset.
    const diaInteiro = !!e.start?.date;
    const inicio = this.instante(e.start);
    const meet =
      e.hangoutLink ??
      e.conferenceData?.entryPoints?.find((p) => p.entryPointType === 'video')
        ?.uri;

    const participantes = (e.attendees ?? [])
      .filter((a) => !!a.email)
      .map((a) => ({
        email: a.email as string,
        ...(a.displayName ? { nome: a.displayName } : {}),
        ...(a.responseStatus
          ? {
              confirmacao: CONFIRMACAO[a.responseStatus] ?? a.responseStatus,
            }
          : {}),
      }));

    return {
      id: e.id,
      titulo: e.summary || '(sem título)',
      ...(e.description ? { descricao: e.description } : {}),
      ...(e.location ? { local: e.location } : {}),
      inicio,
      fim: this.instante(e.end) || inicio,
      diaInteiro,
      ...(e.organizer?.email
        ? { organizador: e.organizer.displayName || e.organizer.email }
        : {}),
      ...(participantes.length ? { participantes } : {}),
      ...(e.htmlLink ? { link: e.htmlLink } : {}),
      ...(meet ? { reuniaoUrl: meet } : {}),
      ...(e.status === 'cancelled' ? { cancelado: true } : {}),
    };
  }

  /** `{dateTime}` ou `{date}` do Google → ISO 8601. */
  private instante(
    quando: { dateTime?: string; date?: string } | undefined,
  ): string {
    if (quando?.dateTime) return new Date(quando.dateTime).toISOString();
    // Dia inteiro: `2026-07-23` é interpretado como meia-noite local, não UTC,
    // para o evento não escorregar de dia em fusos negativos.
    if (quando?.date) return new Date(`${quando.date}T00:00:00`).toISOString();
    return '';
  }
}
