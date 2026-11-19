import { CRISIS_CONTACTS } from "@/shared/constants";

/**
 * 위기 표현이 없어도 항상 보이는 상담 연락처 안내 (PRD 6.4 상시 표시).
 * 평소에는 작고 조용하게 보이도록 카드 없이 한 줄 목록으로 둔다.
 * 위기 표현이 감지된 일기에서는 별도의 큰 안내 상자(CrisisBox)가 나온다.
 */
export function SupportContacts({ id = "support-title" }: { id?: string }) {
  return (
    <footer className="support" aria-labelledby={id}>
      <h2 id={id} className="support__title">
        힘들 때 도움받을 수 있는 곳
      </h2>
      <p className="support__text">
        혼자 견디지 마세요. <strong>지금 당장 위험하다면 119에 바로 연락해 주세요.</strong>
      </p>
      <ul className="support__list">
        {CRISIS_CONTACTS.map((c) => (
          <li key={c.number}>
            <a
              className="support__link"
              href={`tel:${c.number.replace(/-/g, "")}`}
              aria-label={`${c.name} ${c.number}번에 전화하기, ${c.purpose}`}
            >
              {c.name} <span className="support__number">{c.number}</span>
            </a>
          </li>
        ))}
      </ul>
    </footer>
  );
}
