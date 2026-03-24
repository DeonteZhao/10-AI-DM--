import { NextResponse } from "next/server";

const rollDie = (sides: number) => Math.floor(Math.random() * sides) + 1;

const parseDice = (input: string) => {
  const match = input.trim().match(/^(\d+)d(\d+)([+-]\d+)?$/i);
  if (!match) {
    return null;
  }
  const count = Number(match[1]);
  const sides = Number(match[2]);
  const bonus = match[3] ? Number(match[3]) : 0;
  if (!Number.isFinite(count) || !Number.isFinite(sides) || count <= 0 || sides <= 0) {
    return null;
  }
  return { count, sides, bonus };
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    attacker?: string;
    target?: string;
    attackBonus?: number;
    targetAC?: number;
    damageDice?: string;
    roll?: number;
  } | null;
  if (!body?.attacker || !body?.target) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const attackBonus = typeof body.attackBonus === "number" ? body.attackBonus : 0;
  const targetAC = typeof body.targetAC === "number" ? body.targetAC : 10;
  const damageSpec = body.damageDice ?? "1d6";
  const damage = parseDice(damageSpec);
  if (!damage) {
    return NextResponse.json({ error: "Invalid damage dice" }, { status: 400 });
  }
  const attackRoll = typeof body.roll === "number" ? body.roll : rollDie(20);
  const attackTotal = attackRoll + attackBonus;
  const hit = attackRoll === 20 || attackTotal >= targetAC;
  const critical = attackRoll === 20;
  const fumble = attackRoll === 1;
  let damageTotal = 0;
  if (hit && !fumble) {
    for (let i = 0; i < damage.count; i += 1) {
      damageTotal += rollDie(damage.sides);
    }
    if (critical) {
      for (let i = 0; i < damage.count; i += 1) {
        damageTotal += rollDie(damage.sides);
      }
    }
    damageTotal += damage.bonus;
  }
  const summary = hit
    ? `${body.attacker} 命中 ${body.target}，造成 ${damageTotal} 点伤害。`
    : `${body.attacker} 攻击未命中 ${body.target}。`;
  return NextResponse.json({
    result: {
      summary,
      hit,
      critical,
      fumble,
      attackRoll,
      attackTotal,
      targetAC,
      damage: damageTotal,
      hpChange: { attacker: 0, target: -damageTotal }
    }
  });
}
