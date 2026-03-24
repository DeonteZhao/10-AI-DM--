import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    name?: string;
    ruleSet?: string;
    race?: string;
    roleClass?: string;
    background?: string;
    userId?: string;
  } | null;
  if (!body?.name) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase未配置" }, { status: 500 });
  }
  const supabase = createClient(supabaseUrl, supabaseKey);
  const userId =
    body?.userId ??
    (
      await supabase.auth.admin.createUser({
        email: `guest-${randomUUID()}@example.com`,
        email_confirm: true
      })
    ).data.user?.id ??
    null;
  if (!userId) {
    return NextResponse.json({ error: "用户创建失败" }, { status: 500 });
  }
  const { data, error } = await supabase
    .from("characters")
    .insert({
      user_id: userId,
      name: body.name,
      rule_set: body.ruleSet ?? "DND",
      race: body.race ?? null,
      role_class: body.roleClass ?? null,
      background: body.background ?? null
    })
    .select()
    .single();
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "角色写入失败" },
      { status: 500 }
    );
  }
  return NextResponse.json({
    character: {
      id: data.id,
      name: data.name,
      ruleSet: data.rule_set ?? "DND",
      race: data.race ?? null,
      roleClass: data.role_class ?? null,
      background: data.background ?? null,
      userId
    }
  });
}
