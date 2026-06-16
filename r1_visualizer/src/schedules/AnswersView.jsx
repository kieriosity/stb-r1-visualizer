import { formatValue } from '../util.js'

// shape: answers{} -> { Q1: {answer_type, ...}, ... }
// Short answers render on an underlined blank, like the filled-in inquiry
// pages (B / C) of the printed form.
function renderAnswer(a) {
  if (!a || typeof a !== 'object') return <span class="r1-answer-blank">{formatValue(a)}</span>
  switch (a.answer_type) {
    case 'text':
      return <span class="r1-answer-blank">{a.text}</span>
    case 'date':
      return <span class="r1-answer-blank">{a.date}</span>
    case 'choice':
      return <span class="r1-answer-blank">{a.choice}</span>
    case 'not_applicable':
      return <em class="r1-na">Not applicable</em>
    case 'text_list':
      return (
        <ul class="r1-answer-list">
          {(a.text_list || []).map((t) => <li>{t}</li>)}
        </ul>
      )
    default:
      return <pre class="r1-json">{JSON.stringify(a, null, 2)}</pre>
  }
}

// "Q1" -> "1.", "Q5a" -> "5a." to match the form's inquiry numbering.
function questionLabel(k) {
  const bare = String(k).replace(/^Q/i, '')
  return /^\d/.test(bare) ? `${bare}.` : k
}

export function AnswersView({ schedule }) {
  const answers = schedule.answers || {}
  const keys = Object.keys(answers).sort((a, b) => {
    const na = parseInt(a.replace(/\D/g, ''), 10)
    const nb = parseInt(b.replace(/\D/g, ''), 10)
    return na - nb || a.localeCompare(b)
  })
  return (
    <dl class="r1-answers">
      {keys.map((k) => (
        <div class="r1-answer-row">
          <dt class="r1-answer-q">{questionLabel(k)}</dt>
          <dd class="r1-answer-a">{renderAnswer(answers[k])}</dd>
        </div>
      ))}
    </dl>
  )
}

// Fallback for shapes without a dedicated renderer (e.g. Memoranda / content).
export function GenericView({ schedule }) {
  const { revision, schedule_id, ...rest } = schedule
  return <pre class="r1-json">{JSON.stringify(rest, null, 2)}</pre>
}
