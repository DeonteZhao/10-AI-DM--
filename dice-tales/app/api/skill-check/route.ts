import { NextResponse } from "next/server";

type RuleSet = "DND" | "CoC";

const rollDie = (sides: number) => Math.floor(Math.random() * sides) + 1;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    skill?: string;
    dc?: number;
    roll?: number;
    modifier?: number;
    ruleSet?: RuleSet;
  } | null;
  if (!body?.skill || typeof body.dc !== "number") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const ruleSet: RuleSet = body.ruleSet ?? "DND";
  const modifier = typeof body.modifier === "number" ? body.modifier : 0;
  const rawRoll =
    typeof body.roll === "number"
      ? body.roll
      : ruleSet === "CoC"
      ? rollDie(100)
      : rollDie(20);
  const total = ruleSet === "CoC" ? rawRoll : rawRoll + modifier;
  const success = ruleSet === "CoC" ? total <= body.dc : total >= body.dc;
  
  let critical = false;
  let fumble = false;
  let text = success ? "成功" : "失败";

  if (ruleSet === "CoC") {
    const skillValue = body.dc;
    if (rawRoll === 1) {
      critical = true;
      text = "大成功";
    } else if (rawRoll >= 96 && skillValue < 50) {
      fumble = true;
      text = "大失败";
    } else if (rawRoll === 100) {
      fumble = true;
      text = "大失败";
    } else if (rawRoll <= Math.floor(skillValue / 5)) {
      text = "极难成功";
    } else if (rawRoll <= Math.floor(skillValue / 2)) {
      text = "困难成功";
    } else if (rawRoll <= skillValue) {
      text = "常规成功";
    } else {
      text = "失败";
    }
  } else {
    critical = rawRoll === 20;
    fumble = rawRoll === 1;
    if (critical) text = "大成功";
    else if (fumble) text = "大失败";
  }

  return NextResponse.json({
    outcome: {
      success,
      text,
      ruleSet,
      roll: rawRoll,
      total,
      dc: body.dc,
      modifier,
      critical,
      fumble
    }
  });
}
