import { CRISIS_CONTACTS } from "@/shared/constants";

/** 위기 표현이 있을 때 공감 메시지 아래에 보이는 상담 연락처 안내 (PRD 6.4) */
export function CrisisBox({ id }: { id: string }) {
  return (
    <section className="crisis" aria-labelledby={id}>
      <h4 id={id} className="crisis__title">
        <span className="crisis__mark" aria-hidden="true">
          !
        </span>
        혼자 견디지 않으셔도 괜찮아요
      </h4>
      <p className="crisis__text">
        많이 힘드셨군요. 이야기를 들어 줄 분들이 있어요. 아래 번호로 전화하면 도움을 받을 수 있어요.
        지금 당장 위험하다면 119에 바로 연락해 주세요.
      </p>
      <ul className="crisis__list">
        {CRISIS_CONTACTS.map((c) => (
          <li key={c.number}>
            <a
              className="crisis__link"
              href={`tel:${c.number.replace(/-/g, "")}`}
              aria-label={`${c.name} ${c.number}번에 전화하기, ${c.purpose}`}
            >
              <span className="crisis__name">{c.name}</span>
              <span className="crisis__number">{c.number}</span>
              <span className="crisis__purpose">{c.purpose}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
