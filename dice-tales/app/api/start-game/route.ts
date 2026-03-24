import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    moduleId?: string;
    characterId?: string;
    userId?: string;
  } | null;
  if (!body?.moduleId || !body?.characterId) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase未配置" }, { status: 500 });
  }
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: characterData, error: characterError } = await supabase
    .from("characters")
    .select("user_id")
    .eq("id", body.characterId)
    .single();
  if (characterError) {
    return NextResponse.json(
      { error: characterError.message ?? "角色读取失败" },
      { status: 500 }
    );
  }
  const resolvedUserId = body.userId ?? characterData?.user_id ?? null;
  if (!resolvedUserId) {
    return NextResponse.json({ error: "用户缺失" }, { status: 500 });
  }
  const { data, error } = await supabase
    .from("sessions")
    .insert({
      module_id: body.moduleId,
      character_id: body.characterId,
      user_id: resolvedUserId,
      status: "active"
    })
    .select()
    .single();
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "会话创建失败" },
      { status: 500 }
    );
  }
  return NextResponse.json({
    session: {
      id: data.id,
      moduleId: data.module_id,
      characterId: data.character_id
    }
  });
}
