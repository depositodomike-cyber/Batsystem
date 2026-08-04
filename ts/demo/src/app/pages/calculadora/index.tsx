// Import Dependencies
import { useSearchParams } from "react-router";

// Local Imports
import BecultureSignature from "@/assets/branding/beculture-signature.svg?react";
import BecultureSignatureDark from "@/assets/branding/beculture-signature-dark.svg?react";
import { Page } from "@/components/shared/Page";
import { PageTitle } from "@/components/shared/PageTitle";
import { Card } from "@/components/ui";
import {
  ContratoBar,
  SecaoModulos,
  SecaoResumo,
  usePrecificador,
} from "@/components/shared/Precificador";
import { TRIAL_DIAS, parsePlanoCode } from "@/app/data/planos";

// ----------------------------------------------------------------------

export default function Calculadora() {
  const [searchParams] = useSearchParams();
  const precificador = usePrecificador(parsePlanoCode(searchParams.get("plano")));

  return (
    <Page title="Calculadora de preço">
      <main className="min-h-100vh grid w-full grow grid-cols-1 place-items-center py-8">
        <div className="w-full max-w-[56rem] p-4 sm:px-5">
          <div className="text-center">
            <BecultureSignature className="mx-auto h-12 w-auto dark:hidden" />
            <BecultureSignatureDark className="mx-auto hidden h-12 w-auto dark:block" />
            <div className="mt-4">
              <PageTitle
                className="text-2xl font-semibold text-gray-600 dark:text-dark-100"
                wrapperClassName="justify-center"
                help={{ description: (<>
                  <p>A <strong>Calculadora de preço</strong> monta o valor da assinatura combinando os módulos que você escolher — cada módulo tem o seu próprio plano e quantidade.</p>
                  <p>Escolha o ciclo de cobrança, selecione os módulos e veja o resumo com o total estimado. O teste começa grátis, sem compromisso.</p>
                </>) }}
              >
                Calculadora de preço
              </PageTitle>
              <p className="text-gray-400 dark:text-dark-300">
                {`Cada módulo no seu próprio plano · teste grátis de ${TRIAL_DIAS} dias`}
              </p>
            </div>
          </div>

          <Card className="mt-5 rounded-lg p-5 lg:p-7">
            <ContratoBar
              ciclo={precificador.ciclo}
              onChange={precificador.setCiclo}
            />
            <SecaoModulos numero={1} precificador={precificador} />
            <div className="mt-6">
              <SecaoResumo numero={2} precificador={precificador} />
            </div>
          </Card>
        </div>
      </main>
    </Page>
  );
}
