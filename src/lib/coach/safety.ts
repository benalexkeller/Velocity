// Fixed safety check that runs before any model: symptoms that mean stop and see a doctor. No model, no
// judgement, the same answer every time. Both the server (route) and the browser use it.
const RED_FLAGS: RegExp[] = [
  /chest (pain|tight|pressure|discomfort)/i, /pain (in|across) (my )?chest/i, /heart (attack|racing and|skipping|flutter)/i, /palpitation/i,
  /faint(ed|ing)?|passed out|blacked out|black(ing)? out|collaps(ed|ing)/i,
  /dizzy|dizziness|light-?headed|vertigo/i,
  /(can'?t|cannot|could ?n'?t|hard to|trouble|difficulty) breath/i, /short(ness)? of breath/i, /breathless/i, /wheez/i,
  /numb(ness)? (in|down|on) (my )?(arm|face|leg|side)/i, /(arm|face|leg) (is|went|has gone) numb/i, /slurr/i, /vision (loss|went|blurr)/i, /lost vision/i,
  /blood in (my )?(urine|pee|stool|poo)/i, /(coughing|cough(ed)?) (up )?blood/i, /dark (brown|cola) urine/i,
  /severe (headache|abdominal|stomach) pain/i, /worst headache/i,
  /(very |extremely |really )?confus(ed|ion)/i, /disoriented/i,
  /swollen (calf|leg) (and|with) (pain|hot|red)/i, /calf (is )?(hot|red) and swollen/i,
  /suicid|kill myself|end (it all|my life)/i, /self[- ]harm/i,
];

export function redFlag(text: string): "medical" | "crisis" | null {
  const t = text.toLowerCase();
  if (/suicid|kill myself|end (it all|my life)|self[- ]harm/.test(t)) return "crisis";
  return RED_FLAGS.some((r) => r.test(t)) ? "medical" : null;
}

export const RED_FLAG_REPLY = {
  medical: "Stop training now. Chest pain, fainting, dizziness, trouble breathing, numbness, slurred speech, blood in urine or when coughing, severe headache, or a hot swollen calf need a doctor today, or emergency services if it is happening right now. This coach does not assess symptoms. Once a doctor has cleared you, come back and we rebuild the week.",
  crisis: "This matters more than training. If you are in danger right now, call your local emergency number. In the US, call or text 988; in Germany, 0800 111 0 111; elsewhere, findahelpline.com lists a line for your country. Please talk to someone today. The plan can wait.",
} as const;
