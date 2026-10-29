import { useState } from "react";
import type {
  IdentityAssertion,
  SourceSnapshot,
  XmlProfile,
} from "../domain/contracts";
import { active, decide, proposals } from "../identity/matching";
export function IdentityPanel({
  excel,
  xml,
  profile,
  assertions,
  onChange,
}: {
  excel: SourceSnapshot;
  xml: SourceSnapshot;
  profile: XmlProfile;
  assertions: IdentityAssertion[];
  onChange: (next: IdentityAssertion[]) => Promise<void>;
}) {
  const [left, setLeft] = useState(""),
    [right, setRight] = useState(""),
    [error, setError] = useState("");
  const lefts = excel.entities.filter((e) => e.attributes.uo),
    rights = xml.entities.filter((e) =>
      profile.applicationTypes.includes(e.typeRef),
    ),
    suggestions = proposals(excel, xml, profile, assertions);
  async function decidePair(
    l: string,
    r: string,
    decision: IdentityAssertion["decision"],
  ) {
    try {
      setError("");
      const a = lefts.find((e) => e.id === l),
        b = rights.find((e) => e.id === r);
      if (!a || !b) throw Error("Välj ett system från vardera källa.");
      await onChange(decide(a, b, decision, assertions));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <section className="panel">
      <h2>Identitetskopplingar</h2>
      <p className="muted">
        Namn ger bara förslag. En bekräftad koppling gäller dessa källnycklar,
        typer och granskade värden. Ändrade värden kräver ny granskning.
      </p>
      <p className="muted">
        Visar högst 200 namnförslag. Fler kopplingar kan väljas manuellt.
      </p>
      {suggestions.map(({ left, right, reason }) => (
        <div className="source" key={left.id + right.id}>
          <span>
            <strong>
              {left.name} ↔ {right.name}
            </strong>
            <small>{reason}</small>
          </span>
          <div className="actions">
            <button
              className="primary"
              onClick={() => decidePair(left.id, right.id, "confirmed")}
            >
              Bekräfta
            </button>
            <button
              className="secondary"
              onClick={() => decidePair(left.id, right.id, "rejected")}
            >
              Avvisa
            </button>
          </div>
        </div>
      ))}
      {!suggestions.length && (
        <p className="muted">
          Inga nya namnförslag. Koppla även system med olika namn nedan.
        </p>
      )}
      <div className="grid">
        <label>
          System i Excel
          <select
            id="identity-left"
            value={left}
            onChange={(e) => setLeft(e.target.value)}
          >
            <option value="">Välj system</option>
            {lefts.map((e) => (
              <option value={e.id} key={e.id}>
                {e.name} · {e.source.recordId}
              </option>
            ))}
          </select>
        </label>
        <label>
          System i XML
          <select
            id="identity-right"
            value={right}
            onChange={(e) => setRight(e.target.value)}
          >
            <option value="">Välj system</option>
            {rights.map((e) => (
              <option value={e.id} key={e.id}>
                {e.name} · {e.source.recordId}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="actions">
        <button
          className="primary"
          id="identity-confirm"
          disabled={!left || !right}
          onClick={() => decidePair(left, right, "confirmed")}
        >
          Bekräfta vald koppling
        </button>
        <button
          className="secondary"
          disabled={!left || !right}
          onClick={() => decidePair(left, right, "rejected")}
        >
          Avvisa vald koppling
        </button>
      </div>
      <details>
        <summary>{assertions.length} sparade beslut</summary>
        {assertions.map((a, i) => {
          const l = lefts.find((e) => e.id === a.left),
            r = rights.find((e) => e.id === a.right);
          return (
            <div className="source" key={i}>
              <span>
                {l?.name ?? a.left} ↔ {r?.name ?? a.right}
                <small>
                  {a.decision === "confirmed" ? "Bekräftad" : "Avvisad"} ·{" "}
                  {l && r && active(a, l, r)
                    ? "Aktuellt beslut"
                    : "Källa saknas eller ändrade värden – används inte"}
                </small>
              </span>
              <button
                className="secondary"
                onClick={async () => {
                  try {
                    await onChange(assertions.filter((_, j) => j !== i));
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Ta bort beslut
              </button>
            </div>
          );
        })}
      </details>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
