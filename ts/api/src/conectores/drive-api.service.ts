import {
  BadRequestException,
  Injectable,
  Logger,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { OauthProviderService } from './oauth-provider.service';
import { getProviderJson } from './provider-fetch';
import { extrairTexto } from '@/ai/analise/extrair-texto';

/** Um arquivo do Drive, normalizado para a lista de importação. */
export interface DriveArquivo {
  id: string;
  nome: string;
  tipo: string;
  /** Rótulo amigável do tipo (Documento, Planilha, PDF…). */
  tipoRotulo: string;
  modificadoEm: string | null;
  dono: string | null;
  link: string | null;
  tamanho: number | null;
  /** Dá para importar como texto? */
  importavel: boolean;
  /** É uma pasta (navegável; importar = importar o conteúdo). */
  pasta: boolean;
  /** Ids das pastas-mãe no Drive. */
  pais: string[];
}

/** Arquivo dentro de uma pasta importada, com o caminho relativo a ela. */
export interface DriveArquivoNaArvore extends DriveArquivo {
  /** Subpastas entre a pasta importada e o arquivo ("" = direto nela). */
  caminho: string;
}

interface GoogleFile {
  id: string;
  name?: string;
  mimeType?: string;
  modifiedTime?: string;
  webViewLink?: string;
  size?: string;
  parents?: string[];
  owners?: { displayName?: string; emailAddress?: string }[];
}

const MIME_PASTA = 'application/vnd.google-apps.folder';
const CAMPOS_ARQUIVO =
  'id, name, mimeType, modifiedTime, webViewLink, size, parents, owners(displayName, emailAddress)';
/** Tetos da importação recursiva de uma pasta. */
const ARVORE_MAX_ARQUIVOS = 1000;
const ARVORE_MAX_NIVEIS = 15;
const ID_VALIDO = /^[\w-]{10,200}$/;

/** Arquivos nativos do Google: exportados no formato de texto indicado. */
const EXPORTAR: Record<string, { mime: string; rotulo: string }> = {
  'application/vnd.google-apps.document': { mime: 'text/plain', rotulo: 'Documento' },
  'application/vnd.google-apps.spreadsheet': { mime: 'text/csv', rotulo: 'Planilha' },
  'application/vnd.google-apps.presentation': { mime: 'text/plain', rotulo: 'Apresentação' },
};

/** Arquivos comuns baixados e convertidos (extensão usada pelo extrator). */
const BAIXAR: Record<string, { ext: string; rotulo: string }> = {
  'application/pdf': { ext: '.pdf', rotulo: 'PDF' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { ext: '.docx', rotulo: 'Word' },
  'text/plain': { ext: '.txt', rotulo: 'Texto' },
  'text/markdown': { ext: '.md', rotulo: 'Markdown' },
  'text/csv': { ext: '.csv', rotulo: 'CSV' },
};

/** Teto do arquivo baixado (PDF/DOCX grandes estouram memória e o índice). */
const TAMANHO_MAX = 15 * 1024 * 1024;
/** Teto do texto devolvido (o índice do Repositório aceita até 200k). */
const TEXTO_MAX = 190_000;
const POR_PAGINA = 25;

const ctx = (logger: Logger) => ({ logger, label: 'Google Drive', recurso: 'aos arquivos' });

/**
 * Leitura do Google Drive do tenant (escopo `drive.readonly`), com o token
 * OAuth guardado e renovado pelo OauthProviderService. Só lê: lista, busca e
 * baixa o conteúdo em texto para o usuário importar ao Repositório.
 */
@Injectable()
export class DriveApiService {
  private readonly logger = new Logger(DriveApiService.name);

  constructor(private readonly oauth: OauthProviderService) {}

  private token(empresaId: string): Promise<string> {
    return this.oauth.getAccessToken(empresaId, 'google-drive', 'drive');
  }

  /**
   * Conteúdo de uma pasta (pastas primeiro, depois arquivos, por nome) ou, com
   * `busca`, arquivos e pastas de todo o Drive cujo nome/conteúdo casam.
   * `pasta`: "root" (Meu Drive), "compartilhados" ou o id de uma pasta.
   */
  async listar(
    empresaId: string,
    opts: { pasta?: string; busca?: string; pageToken?: string } = {},
  ): Promise<{ arquivos: DriveArquivo[]; proximaPagina: string | null }> {
    const token = await this.token(empresaId);
    const filtros = ['trashed = false'];
    const termo = opts.busca?.trim().slice(0, 200);
    const pasta = opts.pasta?.trim() || 'root';
    if (termo) {
      // Aspas e barras escapadas: o termo vai dentro de uma string da query.
      const seguro = termo.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      filtros.push(`(name contains '${seguro}' or fullText contains '${seguro}')`);
    } else if (pasta === 'compartilhados') {
      filtros.push('sharedWithMe = true');
    } else {
      if (pasta !== 'root' && !ID_VALIDO.test(pasta)) {
        throw new BadRequestException('Pasta do Drive inválida.');
      }
      filtros.push(`'${pasta}' in parents`);
    }
    const params = new URLSearchParams({
      q: filtros.join(' and '),
      pageSize: String(POR_PAGINA),
      fields: `nextPageToken, files(${CAMPOS_ARQUIVO})`,
      // Busca por conteúdo não aceita ordenação.
      ...(termo ? {} : { orderBy: 'folder,name_natural' }),
      includeItemsFromAllDrives: 'true',
      supportsAllDrives: 'true',
    });
    if (opts.pageToken) params.set('pageToken', opts.pageToken);
    const data = await getProviderJson<{ files?: GoogleFile[]; nextPageToken?: string }>(
      ctx(this.logger),
      `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
      token,
    );
    return {
      arquivos: (data.files ?? []).map((f) => this.mapear(f)),
      proximaPagina: data.nextPageToken ?? null,
    };
  }

  /**
   * Pasta e o caminho até ela (da raiz para baixo) — para o breadcrumb quando
   * se entra numa pasta vinda da busca. Para no Meu Drive (ou numa pasta
   * compartilhada cujo pai não é acessível).
   */
  async pasta(
    empresaId: string,
    id: string,
  ): Promise<{ id: string; nome: string; caminho: { id: string; nome: string }[] }> {
    if (!ID_VALIDO.test(id)) throw new BadRequestException('Pasta do Drive inválida.');
    const token = await this.token(empresaId);
    const raiz = await this.meta(token, 'root').catch(() => null);
    const caminho: { id: string; nome: string }[] = [];
    let atual: GoogleFile | null = await this.meta(token, id);
    const alvo = atual;
    for (let i = 0; atual && i < 20; i++) {
      if (raiz && atual.id === raiz.id) break;
      caminho.unshift({ id: atual.id, nome: atual.name || '(sem nome)' });
      const pai: string | undefined = atual.parents?.[0];
      if (!pai) break;
      atual = await this.meta(token, pai).catch(() => null);
    }
    return { id: alvo.id, nome: alvo.name || '(sem nome)', caminho };
  }

  /**
   * Todos os arquivos dentro de uma pasta, recursivamente, com o caminho
   * relativo — para importar a pasta inteira mantendo a estrutura. Pastas não
   * entram na lista (viram parte do caminho). Respeita os tetos de arquivos e
   * de profundidade; `truncado` avisa quando algum foi atingido.
   */
  async arvore(
    empresaId: string,
    id: string,
  ): Promise<{ pasta: { id: string; nome: string }; arquivos: DriveArquivoNaArvore[]; truncado: boolean }> {
    if (!ID_VALIDO.test(id)) throw new BadRequestException('Pasta do Drive inválida.');
    const token = await this.token(empresaId);
    const raiz = await this.meta(token, id);
    if (raiz.mimeType !== MIME_PASTA) throw new BadRequestException('O item escolhido não é uma pasta.');

    const arquivos: DriveArquivoNaArvore[] = [];
    let truncado = false;
    const fila: { id: string; caminho: string; nivel: number }[] = [{ id, caminho: '', nivel: 0 }];
    while (fila.length) {
      const atual = fila.shift()!;
      let pageToken: string | undefined;
      do {
        const params = new URLSearchParams({
          q: `'${atual.id}' in parents and trashed = false`,
          pageSize: '200',
          fields: `nextPageToken, files(${CAMPOS_ARQUIVO})`,
          includeItemsFromAllDrives: 'true',
          supportsAllDrives: 'true',
        });
        if (pageToken) params.set('pageToken', pageToken);
        const data = await getProviderJson<{ files?: GoogleFile[]; nextPageToken?: string }>(
          ctx(this.logger),
          `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
          token,
        );
        for (const f of data.files ?? []) {
          if (f.mimeType === MIME_PASTA) {
            if (atual.nivel + 1 >= ARVORE_MAX_NIVEIS) {
              truncado = true;
              continue;
            }
            const nome = (f.name || 'pasta').replace(/[\\/]/g, '-');
            fila.push({
              id: f.id,
              caminho: atual.caminho ? `${atual.caminho}/${nome}` : nome,
              nivel: atual.nivel + 1,
            });
          } else {
            if (arquivos.length >= ARVORE_MAX_ARQUIVOS) {
              truncado = true;
              break;
            }
            arquivos.push({ ...this.mapear(f), caminho: atual.caminho });
          }
        }
        pageToken = arquivos.length >= ARVORE_MAX_ARQUIVOS ? undefined : data.nextPageToken;
      } while (pageToken);
      if (arquivos.length >= ARVORE_MAX_ARQUIVOS) {
        if (fila.length) truncado = true;
        break;
      }
    }
    return { pasta: { id: raiz.id, nome: raiz.name || 'Pasta' }, arquivos, truncado };
  }

  private meta(token: string, id: string): Promise<GoogleFile> {
    return getProviderJson<GoogleFile>(
      ctx(this.logger),
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=${encodeURIComponent(CAMPOS_ARQUIVO)}&supportsAllDrives=true`,
      token,
    );
  }

  /** Texto do arquivo, pronto para virar nota no Repositório. */
  async conteudo(
    empresaId: string,
    id: string,
  ): Promise<{ arquivo: DriveArquivo; texto: string; truncado: boolean }> {
    if (!/^[\w-]{10,200}$/.test(id)) {
      throw new BadRequestException('Arquivo do Drive inválido.');
    }
    const token = await this.token(empresaId);
    const meta = await getProviderJson<GoogleFile>(
      ctx(this.logger),
      `https://www.googleapis.com/drive/v3/files/${id}?fields=id,name,mimeType,modifiedTime,webViewLink,size,owners(displayName,emailAddress)&supportsAllDrives=true`,
      token,
    );
    const arquivo = this.mapear(meta);
    const mime = meta.mimeType ?? '';

    let texto: string;
    if (EXPORTAR[mime]) {
      const buf = await this.baixar(
        `https://www.googleapis.com/drive/v3/files/${id}/export?mimeType=${encodeURIComponent(EXPORTAR[mime].mime)}`,
        token,
      );
      texto = buf.toString('utf8');
    } else if (BAIXAR[mime]) {
      if (arquivo.tamanho && arquivo.tamanho > TAMANHO_MAX) {
        throw new PayloadTooLargeException('Arquivo grande demais para importar (máx. 15 MB).');
      }
      const buf = await this.baixar(
        `https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true`,
        token,
      );
      try {
        texto = await extrairTexto(buf, `arquivo${BAIXAR[mime].ext}`);
      } catch (err) {
        this.logger.warn(`Falha ao extrair texto do Drive: ${String(err)}`);
        throw new BadRequestException('Não foi possível ler o texto deste arquivo.');
      }
    } else {
      throw new BadRequestException(
        'Este tipo de arquivo não pode ser importado como texto (use Docs, Planilhas, Apresentações, PDF, Word ou texto).',
      );
    }

    texto = texto.replace(/\r\n/g, '\n').trim();
    if (!texto) throw new BadRequestException('O arquivo não tem texto para importar.');
    const truncado = texto.length > TEXTO_MAX;
    return { arquivo, texto: truncado ? texto.slice(0, TEXTO_MAX) : texto, truncado };
  }

  private mapear(f: GoogleFile): DriveArquivo {
    const mime = f.mimeType ?? '';
    const dono = f.owners?.[0];
    return {
      id: f.id,
      nome: f.name || '(sem nome)',
      tipo: mime,
      tipoRotulo: mime === MIME_PASTA ? 'Pasta' : (EXPORTAR[mime]?.rotulo ?? BAIXAR[mime]?.rotulo ?? 'Outro'),
      modificadoEm: f.modifiedTime ?? null,
      dono: dono?.displayName || dono?.emailAddress || null,
      link: f.webViewLink ?? null,
      tamanho: f.size ? Number(f.size) : null,
      importavel: !!(EXPORTAR[mime] || BAIXAR[mime]),
      pasta: mime === MIME_PASTA,
      pais: f.parents ?? [],
    };
  }

  /** Download autenticado com teto de tamanho (lido em streaming). */
  private async baixar(url: string, token: string): Promise<Buffer> {
    let res: Response;
    try {
      res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    } catch (err) {
      this.logger.error(err);
      throw new ServiceUnavailableException('Falha ao falar com o Google Drive. Tente novamente.');
    }
    if (!res.ok) {
      const detalhe = await res.text().catch(() => '');
      this.logger.warn(`Google Drive ${res.status}: ${detalhe.slice(0, 300)}`);
      if (res.status === 401 || res.status === 403) {
        throw new BadRequestException(
          'O Google Drive recusou o acesso ao arquivo. Reconecte em Conectores → Google Drive.',
        );
      }
      throw new ServiceUnavailableException(`O Google Drive retornou um erro (${res.status}).`);
    }
    const partes: Uint8Array[] = [];
    let total = 0;
    const leitor = res.body?.getReader();
    if (!leitor) return Buffer.alloc(0);
    for (;;) {
      const { done, value } = await leitor.read();
      if (done) break;
      total += value.byteLength;
      if (total > TAMANHO_MAX) {
        await leitor.cancel();
        throw new PayloadTooLargeException('Arquivo grande demais para importar (máx. 15 MB).');
      }
      partes.push(value);
    }
    return Buffer.concat(partes);
  }
}
