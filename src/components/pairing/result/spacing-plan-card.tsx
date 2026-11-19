import { Clock3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SpacingPlan } from '../pairing-engine'

export function SpacingPlanCard({
  plan,
  artById,
}: {
  plan: SpacingPlan
  artById: Map<string, string>
}) {
  return (
    <section className="po-plan po-tone-spacing">
      <header className="po-plan-head">
        <span className="po-plan-icon">
          <Clock3 size={17} strokeWidth={1.8} aria-hidden="true" />
        </span>
        <div className="po-plan-heading">
          <span className="po-kicker">SMART SCHEDULE</span>
          <h3 className="po-plan-title">智能错峰建议</h3>
        </div>
        <span className="po-plan-total">间隔 ≥{plan.totalHours} 小时</span>
      </header>

      <ol className="po-plan-steps">
        {plan.steps.map((step, index) => (
          <li className={cn('po-plan-step', `is-${step.kind}`)} key={step.id}>
            <span className="po-plan-index" aria-hidden="true">
              {String(index + 1).padStart(2, '0')}
            </span>
            <div className="po-plan-body">
              <div className="po-plan-step-head">
                <span>{step.label}</span>
              </div>
              <p className="po-plan-detail">{step.detail}</p>
              <div className="po-plan-items">
                {step.items.map((item) => (
                  <span className="po-plan-item" key={item.id} title={item.name}>
                    {artById.get(item.id) ? (
                      <img
                        alt=""
                        decoding="async"
                        draggable={false}
                        src={artById.get(item.id)}
                      />
                    ) : null}
                    <span>{item.name}</span>
                  </span>
                ))}
              </div>
            </div>
          </li>
        ))}
      </ol>

      <p className="po-plan-note">
        以药品说明书为准；缓释、肠溶或特殊剂型请先咨询药师。
      </p>
    </section>
  )
}