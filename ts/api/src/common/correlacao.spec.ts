import {
  comCorrelacao,
  idDaRequisicao,
  LoggerComCorrelacao,
  middlewareCorrelacao,
} from './correlacao';
import type { Request, Response } from 'express';

function requisicao(header?: string) {
  const req = { header: jest.fn(() => header) } as unknown as Request;
  const res = { setHeader: jest.fn() } as unknown as Response;
  return { req, res };
}

describe('correlação de requisições', () => {
  it('reaproveita um X-Request-Id válido e o devolve na resposta', () => {
    const { req, res } = requisicao('abc-123');
    let visto: string | undefined;
    middlewareCorrelacao(req, res, () => {
      visto = idDaRequisicao();
    });
    expect(visto).toBe('abc-123');
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', 'abc-123');
  });

  it.each([undefined, '', 'tem espaço', 'x'.repeat(65), 'quebra\nlinha'])(
    'gera um id novo para header %j',
    (h) => {
      const { req, res } = requisicao(h);
      let visto: string | undefined;
      middlewareCorrelacao(req, res, () => {
        visto = idDaRequisicao();
      });
      expect(visto).toMatch(/^[0-9a-f-]{36}$/);
    },
  );

  it('o id sobrevive a continuações assíncronas da requisição', async () => {
    const { req, res } = requisicao('req-1');
    const visto = await new Promise<string | undefined>((resolve) => {
      middlewareCorrelacao(req, res, () => {
        setTimeout(() => void Promise.resolve().then(() => resolve(idDaRequisicao())), 1);
      });
    });
    expect(visto).toBe('req-1');
    expect(idDaRequisicao()).toBeUndefined();
  });

  it('o logger acrescenta o id ao contexto só dentro de uma requisição', () => {
    class Exposto extends LoggerComCorrelacao {
      contexto(c: string) {
        return this.formatContext(c);
      }
    }
    const logger = new Exposto({ colors: false });
    expect(logger.contexto('Svc')).toBe('[Svc] ');
    expect(comCorrelacao('r9', () => logger.contexto('Svc'))).toBe('[Svc] [req r9] ');
  });
});
