"use client";
// Admin access to the library table: list, save, delete. The bundled passages are read-only here (edit the file).
import { supabase } from "@/lib/supabase/client";
import type { Passage } from "./library";

export interface LibraryRow extends Passage { published: boolean; updated_at: string }

export async function listLibraryRows(): Promise<LibraryRow[]> {
  const sb = supabase(); if (!sb) return [];
  const { data, error } = await sb.from("library").select("*").order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as LibraryRow[]) ?? [];
}
export async function saveLibraryRow(r: Omit<LibraryRow, "updated_at">): Promise<void> {
  const sb = supabase(); if (!sb) throw new Error("No database in local mode.");
  const { error } = await sb.rpc("admin_library_upsert", { p_id: r.id, p_title: r.title, p_topic: r.topic, p_grade: r.grade, p_tags: r.tags, p_body: r.body, p_source: r.source, p_url: r.url, p_published: r.published });
  if (error) throw new Error(error.message);
}
export async function deleteLibraryRow(id: string): Promise<void> {
  const sb = supabase(); if (!sb) throw new Error("No database in local mode.");
  const { error } = await sb.rpc("admin_library_delete", { p_id: id });
  if (error) throw new Error(error.message);
}
