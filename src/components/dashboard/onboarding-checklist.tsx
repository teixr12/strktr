'use client'

import Link from 'next/link'
import { CheckCircle2, Circle, HardHat, Crown, Users, Wallet } from 'lucide-react'

interface OnboardingChecklistProps {
  obrasCount: number
  leadsCount: number
  membrosCount: number
  transacoesCount: number
}

const STEPS = [
  {
    key: 'obra',
    label: 'Crie sua primeira obra',
    description: 'Destravar cronograma, checklist e diário operacional.',
    href: '/obras',
    icon: HardHat,
    check: (p: OnboardingChecklistProps) => p.obrasCount > 0,
  },
  {
    key: 'lead',
    label: 'Cadastre um lead',
    description: 'Ativar SLA comercial e próxima melhor ação.',
    href: '/leads',
    icon: Crown,
    check: (p: OnboardingChecklistProps) => p.leadsCount > 0,
  },
  {
    key: 'equipe',
    label: 'Convide sua equipe',
    description: 'Definir permissões e acompanhar produtividade.',
    href: '/equipe',
    icon: Users,
    check: (p: OnboardingChecklistProps) => p.membrosCount > 1,
  },
  {
    key: 'transacao',
    label: 'Registre uma transação',
    description: 'Acompanhar o fluxo de caixa em tempo real.',
    href: '/financeiro',
    icon: Wallet,
    check: (p: OnboardingChecklistProps) => p.transacoesCount > 0,
  },
] as const

export function OnboardingChecklist(props: OnboardingChecklistProps) {
  const completed = STEPS.filter((s) => s.check(props)).length
  const progress = Math.round((completed / STEPS.length) * 100)

  if (completed === STEPS.length) return null

  return (
    <div className="enterprise-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Primeiros passos
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {completed} de {STEPS.length} concluídos
          </p>
        </div>
        <span className="text-sm font-semibold text-sand-600 dark:text-sand-400">
          {progress}%
        </span>
      </div>

      <div className="mb-4 h-2 rounded-full bg-gray-200 dark:bg-gray-800">
        <div
          className="h-2 rounded-full bg-gradient-to-r from-sand-500 to-ocean-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="space-y-2">
        {STEPS.map((step) => {
          const done = step.check(props)
          const Icon = step.icon
          return (
            <Link
              key={step.key}
              href={step.href}
              className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
                done
                  ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-900/10'
                  : 'border-gray-200 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900'
              }`}
            >
              {done ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
              ) : (
                <Circle className="h-5 w-5 shrink-0 text-gray-300 dark:text-gray-600" />
              )}
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Icon className={`h-4 w-4 shrink-0 ${done ? 'text-emerald-500' : 'text-gray-400'}`} />
                <div className="min-w-0">
                  <p className={`text-sm font-medium ${done ? 'text-emerald-700 line-through dark:text-emerald-300' : 'text-gray-900 dark:text-gray-100'}`}>
                    {step.label}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {step.description}
                  </p>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
