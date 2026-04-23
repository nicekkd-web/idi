const { useState, useEffect, useCallback } = React;

const SLOTS_KEY = "idi-slots-v4";
const ADMIN_PW = "wjtkb2026";
const NAVY = "#1B2A4A";
const ORANGE = "#E67E22";
const LIGHT_BG = "#F7F9FC";

const DATES = ["4/27 (월)", "4/28 (화)", "4/29 (수)", "4/30 (목)"];
const DATE_LOCATION = {
  "4/27 (월)": "청계에서 진행",
  "4/28 (화)": "청계에서 진행",
  "4/29 (수)": "파주에서 진행",
  "4/30 (목)": "청계에서 진행",
};
const SLOT_CONFIG = {
  "4/27 (월)": ["10:00–10:30","10:40–11:10","13:30–14:00","14:10–14:40","14:50–15:20","15:30–16:00","16:10–16:40","16:50–17:20"],
  "4/28 (화)": ["10:00–10:30","10:40–11:10","13:30–14:00","14:10–14:40","14:50–15:20","15:30–16:00","16:10–16:40","16:50–17:20"],
  "4/29 (수)": ["10:00–10:30","10:40–11:10","13:30–14:00","14:10–14:40","14:50–15:20","15:30–16:00"],
  "4/30 (목)": ["10:00–10:30","10:40–11:10","13:30–14:00","14:10–14:40","16:10–16:40","16:50–17:20"],
};

const DEFAULT_SLOTS = DATES.flatMap((date, di) =>
  SLOT_CONFIG[date].map((time, ti) => ({
    id: `d${di + 1}s${ti + 1}`,
    date,
    time,
    booked: false,
    name: "",
    dept: "",
    segment: "",
    childAge: "",
  }))
);

const SEGMENTS = [
  { value: "infant", label: "영아 (0~2세)" },
  { value: "toddler", label: "유아 (3~6세)" },
  { value: "lowerElem", label: "초등 저학년 (1~3)" },
  { value: "upperElem", label: "초등 고학년 (4~6)" },
  { value: "middle", label: "중등" },
];

const segLabel = (v) => SEGMENTS.find((s) => s.value === v)?.label || "-";

// JSONBin.io 기반 공유 저장소
const JSONBIN_BIN_ID = "69e96a95856a68218961a7b5";
const JSONBIN_MASTER_KEY = "$2a$10$U.8PXrcsOoSNfeejrKSf8Oh2RlnUSldOuWrok7vzzHDMnZvIJYp4a";
const JSONBIN_URL = `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`;

const storage = {
  async get() {
    try {
      const res = await fetch(`${JSONBIN_URL}/latest`, {
        method: "GET",
        headers: {
          "X-Master-Key": JSONBIN_MASTER_KEY,
          "X-Bin-Meta": "false",
        },
        cache: "no-store",
      });
      if (!res.ok) return null;
      const data = await res.json();
      // data shape: { slots: [...] } 또는 빈 객체
      if (data && Array.isArray(data.slots) && data.slots.length > 0) {
        return { value: JSON.stringify(data.slots) };
      }
      return null;
    } catch (e) {
      console.error("JSONBin GET error:", e);
      return null;
    }
  },
  async set(value) {
    try {
      const slots = JSON.parse(value);
      const res = await fetch(JSONBIN_URL, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Master-Key": JSONBIN_MASTER_KEY,
        },
        body: JSON.stringify({ slots }),
      });
      return res.ok;
    } catch (e) {
      console.error("JSONBin PUT error:", e);
      return false;
    }
  },
};

function InterviewScheduler() {
  const [slots, setSlots] = useState(DEFAULT_SLOTS);
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [name, setName] = useState("");
  const [dept, setDept] = useState("");
  const [segment, setSegment] = useState("");
  const [childAge, setChildAge] = useState("");
  const [step, setStep] = useState("select");
  const [confirmedInfo, setConfirmedInfo] = useState(null);
  const [error, setError] = useState("");

  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPwInput, setAdminPwInput] = useState("");
  const [adminAuthed, setAdminAuthed] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const loadSlots = useCallback(async () => {
    try {
      const result = await storage.get();
      if (result && result.value) {
        const parsed = JSON.parse(result.value);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // 기존 DEFAULT_SLOTS와 병합하여 신규 슬롯 구성이 추가되어도 반영되도록 함
          const merged = DEFAULT_SLOTS.map((def) => {
            const found = parsed.find((p) => p.id === def.id);
            return found ? found : def;
          });
          setSlots(merged);
        }
      }
    } catch (e) {}
    setLoading(false);
  }, []);

  useEffect(() => { loadSlots(); }, [loadSlots]);
  useEffect(() => {
    const interval = setInterval(loadSlots, 5000);
    return () => clearInterval(interval);
  }, [loadSlots]);

  const saveSlots = async (updated) => {
    const ok = await storage.set(JSON.stringify(updated));
    if (ok) { setSlots(updated); return true; }
    return false;
  };

  const bookSlot = async () => {
    if (!name.trim() || !segment || !selectedSlot) {
      setError("이름과 자녀 연령대를 입력해주세요.");
      return;
    }
    setError("");
    let latest = slots;
    try {
      const res = await storage.get();
      if (res && res.value) {
        const parsed = JSON.parse(res.value);
        latest = DEFAULT_SLOTS.map((def) => {
          const found = parsed.find((p) => p.id === def.id);
          return found ? found : def;
        });
      }
    } catch (e) {}

    const target = latest.find((s) => s.id === selectedSlot);
    if (target && target.booked) {
      setError("이미 선택된 시간입니다. 다른 시간을 선택해주세요.");
      setSelectedSlot(null);
      setSlots(latest);
      return;
    }

    const updated = latest.map((s) =>
      s.id === selectedSlot
        ? { ...s, booked: true, name: name.trim(), dept: dept.trim(), segment, childAge: childAge.trim() }
        : s
    );
    const ok = await saveSlots(updated);
    if (ok) {
      setConfirmedInfo({ name: name.trim(), slot: updated.find((s) => s.id === selectedSlot) });
      setStep("confirmed");
    } else {
      setError("저장 중 오류가 발생했습니다. 다시 시도해주세요.");
    }
  };

  const deleteSingle = async (id) => {
    let latest = slots;
    try {
      const res = await storage.get();
      if (res && res.value) latest = JSON.parse(res.value);
    } catch (e) {}
    const updated = latest.map((s) =>
      s.id === id ? { ...s, booked: false, name: "", dept: "", segment: "", childAge: "" } : s
    );
    await saveSlots(updated);
    setDeleteConfirmId(null);
  };

  const resetAll = async () => { await saveSlots([...DEFAULT_SLOTS]); };

  const handleAdminLogin = () => {
    if (adminPwInput === ADMIN_PW) {
      setAdminAuthed(true);
      setAdminError("");
      setShowAdminLogin(false);
      setAdminPwInput("");
    } else {
      setAdminError("비밀번호가 일치하지 않습니다.");
    }
  };

  const grouped = slots.reduce((acc, s) => {
    if (!acc[s.date]) acc[s.date] = [];
    acc[s.date].push(s);
    return acc;
  }, {});

  const bookedSlots = slots.filter((s) => s.booked);
  const bookedCount = bookedSlots.length;
  const totalCount = slots.length;

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400, fontFamily: "'Pretendard','Noto Sans KR',sans-serif" }}>
        <div style={{ color: NAVY, fontSize: 16 }}>불러오는 중...</div>
      </div>
    );
  }

  if (step === "confirmed" && confirmedInfo) {
    return (
      <div style={{ minHeight: "100vh", background: LIGHT_BG, fontFamily: "'Pretendard','Noto Sans KR',sans-serif", display: "flex", justifyContent: "center", alignItems: "center", padding: 20 }}>
        <div style={{ background: "white", borderRadius: 16, padding: "48px 40px", maxWidth: 440, width: "100%", textAlign: "center", boxShadow: "0 4px 24px rgba(27,42,74,0.08)" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#E8F5E9", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: 28, color: "#4CAF50", fontWeight: 700 }}>✓</div>
          <h2 style={{ color: NAVY, fontSize: 22, margin: "0 0 8px", fontWeight: 700 }}>예약이 완료되었습니다</h2>
          <p style={{ color: "#888", fontSize: 14, margin: "0 0 28px" }}>아래 일정으로 확정되었습니다</p>
          <div style={{ background: LIGHT_BG, borderRadius: 12, padding: "20px 24px", textAlign: "left", marginBottom: 28 }}>
            {[["이름", confirmedInfo.name], ["날짜", confirmedInfo.slot.date], ["시간", confirmedInfo.slot.time], ["장소", DATE_LOCATION[confirmedInfo.slot.date] || "사내 회의실 (별도 안내)"]].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ color: "#888", fontSize: 13 }}>{k}</span>
                <span style={{ color: NAVY, fontSize: 14, fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>
          <p style={{ color: "#999", fontSize: 12, lineHeight: 1.6 }}>변경이 필요하시면 신성장기획팀으로 연락 부탁드립니다.</p>
          <button onClick={() => {
            setStep("select");
            setConfirmedInfo(null);
            setSelectedSlot(null);
            setName(""); setDept(""); setSegment(""); setChildAge("");
          }} style={{ marginTop: 20, background: "none", border: "none", color: "#aaa", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>처음으로 돌아가기</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: LIGHT_BG, fontFamily: "'Pretendard','Noto Sans KR',sans-serif", padding: "24px 16px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: ORANGE, letterSpacing: 2, marginBottom: 6 }}>In-depth Interview</div>
          <h1 style={{ color: NAVY, fontSize: 22, fontWeight: 800, margin: "0 0 6px", lineHeight: 1.3 }}>인터뷰 일정 선택</h1>
          <p style={{ color: "#888", fontSize: 13, margin: 0 }}>원하시는 시간을 선택해주세요</p>
          <div style={{ marginTop: 12, display: "inline-flex", alignItems: "center", gap: 8, background: "white", borderRadius: 20, padding: "6px 16px", fontSize: 13 }}>
            <span style={{ color: ORANGE, fontWeight: 700 }}>{bookedCount}</span>
            <span style={{ color: "#aaa" }}>/</span>
            <span style={{ color: NAVY, fontWeight: 600 }}>{totalCount}</span>
            <span style={{ color: "#999" }}>예약됨</span>
          </div>
        </div>

        {/* Slot Grid */}
        {DATES.map((date) => {
          const dateSlots = grouped[date] || [];
          const morning = dateSlots.filter((s) => s.time.startsWith("10"));
          const afternoon = dateSlots.filter((s) => !s.time.startsWith("10"));
          return (
            <div key={date} style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, paddingLeft: 4, flexWrap: "wrap" }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>{date}</span>
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  color: DATE_LOCATION[date].includes("파주") ? "#2E86C1" : "#27AE60",
                  background: DATE_LOCATION[date].includes("파주") ? "#EAF4FB" : "#EAFAF1",
                  borderRadius: 20, padding: "3px 10px",
                }}>📍 {DATE_LOCATION[date]}</span>
              </div>
              {[{ label: "오전", items: morning }, { label: "오후", items: afternoon }].map(({ label, items }) =>
                items.length > 0 ? (
                  <div key={label} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#999", marginBottom: 4, paddingLeft: 4 }}>{label}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {items.map((slot) => {
                        const isSel = selectedSlot === slot.id;
                        const isBk = slot.booked;
                        return (
                          <button key={slot.id}
                            onClick={() => !isBk && setSelectedSlot(isSel ? null : slot.id)}
                            disabled={isBk}
                            style={{
                              flex: "1 1 calc(50% - 3px)", minWidth: 140,
                              display: "flex", alignItems: "center", justifyContent: "space-between",
                              padding: "12px 14px", borderRadius: 10,
                              border: isSel ? `2px solid ${ORANGE}` : "2px solid transparent",
                              background: isBk ? "#F0F0F0" : isSel ? "#FFF8F0" : "white",
                              cursor: isBk ? "not-allowed" : "pointer",
                              transition: "all 0.15s ease",
                              boxShadow: isSel ? `0 2px 12px rgba(230,126,34,0.15)` : "0 1px 4px rgba(0,0,0,0.04)",
                              fontFamily: "inherit",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div style={{
                                width: 16, height: 16, borderRadius: "50%",
                                border: isBk ? "none" : isSel ? `2px solid ${ORANGE}` : "2px solid #ccc",
                                background: isBk ? "#bbb" : isSel ? ORANGE : "white",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 10, color: "white", fontWeight: 700, flexShrink: 0,
                              }}>
                                {isBk ? "—" : isSel ? "✓" : ""}
                              </div>
                              <span style={{
                                fontSize: 14, fontWeight: 600,
                                color: isBk ? "#aaa" : NAVY,
                                textDecoration: isBk ? "line-through" : "none",
                              }}>
                                {slot.time}
                              </span>
                            </div>
                            {isBk && <span style={{ fontSize: 10, fontWeight: 700, color: "white", background: "#bbb", borderRadius: 10, padding: "2px 8px" }}>마감</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null
              )}
            </div>
          );
        })}

        {/* Booking Form */}
        {selectedSlot && (
          <div style={{
            background: "white", borderRadius: 14, padding: "24px 20px",
            marginTop: 8, boxShadow: "0 4px 20px rgba(27,42,74,0.06)",
            border: `1px solid rgba(230,126,34,0.2)`,
          }}>
            <h3 style={{ color: NAVY, fontSize: 16, fontWeight: 700, margin: "0 0 4px" }}>예약 정보 입력</h3>
            <p style={{ color: ORANGE, fontSize: 13, fontWeight: 600, margin: "0 0 16px" }}>
              {slots.find((s) => s.id === selectedSlot)?.date} {slots.find((s) => s.id === selectedSlot)?.time}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input type="text" placeholder="이름 *" value={name} onChange={(e) => setName(e.target.value)}
                style={{ padding: "12px 14px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14, outline: "none", fontFamily: "inherit" }} />
              <input type="text" placeholder="소속 부서" value={dept} onChange={(e) => setDept(e.target.value)}
                style={{ padding: "12px 14px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14, outline: "none", fontFamily: "inherit" }} />
              <select value={segment} onChange={(e) => setSegment(e.target.value)}
                style={{ padding: "12px 14px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14, outline: "none", fontFamily: "inherit", color: segment ? NAVY : "#999", background: "white" }}>
                <option value="" disabled>자녀 연령대 선택 *</option>
                {SEGMENTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <input type="text" placeholder="자녀 나이 (예: 6세, 초2)" value={childAge} onChange={(e) => setChildAge(e.target.value)}
                style={{ padding: "12px 14px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14, outline: "none", fontFamily: "inherit" }} />
            </div>
            {error && <p style={{ color: "#E74C3C", fontSize: 13, margin: "12px 0 0" }}>{error}</p>}
            <button onClick={bookSlot}
              style={{ width: "100%", marginTop: 16, padding: "14px", background: ORANGE, color: "white", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              예약 확정하기
            </button>
          </div>
        )}

        {/* Admin */}
        <div style={{ textAlign: "center", marginTop: 40 }}>
          {!adminAuthed ? (
            <React.Fragment>
              {!showAdminLogin ? (
                <button onClick={() => setShowAdminLogin(true)}
                  style={{ background: "none", border: "none", color: "#ccc", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>관리자</button>
              ) : (
                <div style={{ background: "white", borderRadius: 12, padding: 20, maxWidth: 320, margin: "0 auto", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
                  <p style={{ color: NAVY, fontSize: 14, fontWeight: 600, margin: "0 0 12px" }}>관리자 비밀번호를 입력하세요</p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input type="password" value={adminPwInput} onChange={(e) => { setAdminPwInput(e.target.value); setAdminError(""); }}
                      onKeyDown={(e) => e.key === "Enter" && handleAdminLogin()} placeholder="비밀번호"
                      style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14, outline: "none", fontFamily: "inherit" }} />
                    <button onClick={handleAdminLogin}
                      style={{ padding: "10px 16px", background: NAVY, color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>확인</button>
                  </div>
                  {adminError && <p style={{ color: "#E74C3C", fontSize: 12, margin: "8px 0 0" }}>{adminError}</p>}
                  <button onClick={() => { setShowAdminLogin(false); setAdminPwInput(""); setAdminError(""); }}
                    style={{ background: "none", border: "none", color: "#aaa", fontSize: 12, cursor: "pointer", marginTop: 8, fontFamily: "inherit" }}>취소</button>
                </div>
              )}
            </React.Fragment>
          ) : (
            <div style={{ background: "white", borderRadius: 14, padding: 24, boxShadow: "0 4px 20px rgba(0,0,0,0.06)", textAlign: "left" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h3 style={{ color: NAVY, fontSize: 17, fontWeight: 700, margin: 0 }}>
                  예약 현황 <span style={{ fontSize: 13, fontWeight: 400, color: "#888", marginLeft: 8 }}>({bookedCount}건)</span>
                </h3>
                <button onClick={() => { setAdminAuthed(false); setDeleteConfirmId(null); }}
                  style={{ background: "none", border: "none", color: "#aaa", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>관리자 닫기</button>
              </div>

              {bookedSlots.length === 0 ? (
                <p style={{ color: "#aaa", fontSize: 14, textAlign: "center", padding: 24 }}>아직 예약이 없습니다</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {bookedSlots.map((s) => (
                    <div key={s.id} style={{
                      background: LIGHT_BG, borderRadius: 10, padding: "14px 16px",
                      border: deleteConfirmId === s.id ? "1px solid #E74C3C" : "1px solid transparent",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>{s.name}</span>
                            <span style={{ fontSize: 11, background: ORANGE, color: "white", borderRadius: 10, padding: "2px 8px", fontWeight: 600 }}>{segLabel(s.segment)}</span>
                          </div>
                          <div style={{ fontSize: 13, color: "#666", lineHeight: 1.6 }}>
                            <span>{s.date} {s.time}</span>
                            {s.dept && <span style={{ marginLeft: 8, color: "#999" }}>· {s.dept}</span>}
                            {s.childAge && <span style={{ marginLeft: 8, color: "#999" }}>· {s.childAge}</span>}
                          </div>
                        </div>
                        <div>
                          {deleteConfirmId === s.id ? (
                            <div style={{ display: "flex", gap: 6 }}>
                              <button onClick={() => deleteSingle(s.id)}
                                style={{ padding: "6px 12px", background: "#E74C3C", color: "white", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>삭제</button>
                              <button onClick={() => setDeleteConfirmId(null)}
                                style={{ padding: "6px 12px", background: "#eee", color: "#666", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>취소</button>
                            </div>
                          ) : (
                            <button onClick={() => setDeleteConfirmId(s.id)}
                              style={{ padding: "6px 10px", background: "none", border: "1px solid #ddd", borderRadius: 6, fontSize: 12, color: "#999", cursor: "pointer", fontFamily: "inherit" }}>삭제</button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: "#bbb" }}>비밀번호: {ADMIN_PW}</span>
                <button onClick={resetAll}
                  style={{ padding: "8px 16px", background: "white", color: "#E74C3C", border: "1px solid #E74C3C", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>전체 초기화</button>
              </div>
            </div>
          )}
        </div>

        <p style={{ textAlign: "center", color: "#bbb", fontSize: 11, marginTop: 24, paddingBottom: 20 }}>웅진씽크빅 마케팅실 신성장기획팀</p>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<InterviewScheduler />);
