// Origem do fluxo OAuth (web × Oracle Desktop): viaja no `state` assinado e
// decide só o destino do retorno — nunca quem é dono da autorização.
import type { ConfigService } from '@nestjs/config';
import type { CryptoService } from '@/ai/crypto';
import { OauthStateService } from './oauth-state.service';
import {
  enviarRetornoOauth,
  oauthRetorno,
  origemOauth,
  paginaRetornoDesktop,
  RETORNO_DESKTOP,
} from './oauth-retorno';

const config = { get: (_k: string, d?: string) => (_k === 'ENCRYPTION_KEY' ? 'k'.repeat(64) : d) };
const crypto = { encrypt: (s: string) => `enc:${s}`, decrypt: (s: string) => s.slice(4) };
const svc = new OauthStateService(
  config as unknown as ConfigService,
  crypto as unknown as CryptoService,
);

describe('OAuth — origem desktop', () => {
  it('state do desktop carrega a origem; o da web não', () => {
    const d = svc.sign('emp', 'gmail', 'ver', 'usr', 'desktop');
    const w = svc.sign('emp', 'gmail', 'ver', 'usr');
    expect(svc.verify(d).origem).toBe('desktop');
    expect(svc.verify(w).origem).toBeUndefined();
    expect(svc.origemDe(d)).toBe('desktop');
    expect(svc.origemDe(w)).toBeUndefined();
  });

  it('origemDe ignora state adulterado, vazio ou malformado', () => {
    const d = svc.sign('emp', 'gmail', undefined, undefined, 'desktop');
    const [payload] = d.split('.');
    expect(svc.origemDe(`${payload}.forjado`)).toBeUndefined();
    expect(svc.origemDe(undefined)).toBeUndefined();
    expect(svc.origemDe('lixo')).toBeUndefined();
  });

  it('origemDe vale mesmo com o state expirado (só escolhe o destino)', () => {
    const agora = Date.now();
    const d = svc.sign('emp', 'gmail', undefined, undefined, 'desktop');
    jest.spyOn(Date, 'now').mockReturnValue(agora + 11 * 60 * 1000);
    expect(() => svc.verify(d)).toThrow();
    expect(svc.origemDe(d)).toBe('desktop');
    jest.restoreAllMocks();
  });

  it('só aceita o valor exato "desktop" vindo da query', () => {
    expect(origemOauth('desktop')).toBe('desktop');
    expect(origemOauth('Desktop')).toBeUndefined();
    expect(origemOauth(['desktop'])).toBeUndefined();
    expect(origemOauth(undefined)).toBeUndefined();
  });

  it('retorno ao desktop usa o protocolo do app com os mesmos parâmetros', () => {
    expect(oauthRetorno(RETORNO_DESKTOP, 'gmail', { conta: 'a@b.com' })).toBe(
      'oracle-desktop://conectores?conector=gmail&status=ok&conta=a%40b.com',
    );
  });
});

describe('OAuth — página de retorno ao desktop', () => {
  const resFalso = () => {
    const r = {
      redirecionado: '',
      corpo: '',
      codigo: 0,
      redirect(u: string) {
        r.redirecionado = u;
      },
      setHeader() {},
      status(c: number) {
        r.codigo = c;
        return r;
      },
      type() {
        return r;
      },
      send(b: string) {
        r.corpo = b;
      },
    };
    return r;
  };

  it('web continua com redirect', () => {
    const r = resFalso();
    enviarRetornoOauth(
      r as never,
      'http://localhost:5173/oracle/conectores?conector=gmail&status=ok',
    );
    expect(r.redirecionado).toContain('localhost:5173');
    expect(r.corpo).toBe('');
  });

  it('desktop recebe uma página (não um 302) que abre o app', () => {
    const r = resFalso();
    const destino = oauthRetorno(RETORNO_DESKTOP, 'gmail', {
      conta: 'a@b.com',
    });
    enviarRetornoOauth(r as never, destino);
    expect(r.redirecionado).toBe('');
    expect(r.codigo).toBe(200);
    expect(r.corpo).toContain('Autorização concluída');
    expect(r.corpo).toContain(`href="${destino.replace(/&/g, '&#38;')}"`);
  });

  it('escapa o motivo do erro', () => {
    const html = paginaRetornoDesktop(
      oauthRetorno(RETORNO_DESKTOP, 'gmail', { motivo: '<script>x</script>' }),
    );
    expect(html).not.toContain('<script>x');
    expect(html).toContain('&#60;script&#62;x');
  });
});
