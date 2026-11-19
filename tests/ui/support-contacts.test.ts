import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CRISIS_CONTACTS } from "@/shared/constants";
import { SupportContacts } from "@/ui/components/SupportContacts";

describe("상시 상담 연락처 안내", () => {
  const html = renderToStaticMarkup(createElement(SupportContacts));

  it("제목과 119 안내가 보인다", () => {
    expect(html).toContain("힘들 때 도움받을 수 있는 곳");
    expect(html).toContain("지금 당장 위험하다면 119");
  });

  it("CRISIS_CONTACTS의 모든 연락처가 전화 링크로 나온다", () => {
    for (const c of CRISIS_CONTACTS) {
      expect(html).toContain(`href="tel:${c.number.replace(/-/g, "")}"`);
      expect(html).toContain(c.name);
      expect(html).toContain(c.purpose);
    }
  });
});
