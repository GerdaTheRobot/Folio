import { supabase } from './supabase'

export async function getPortfolios() {
  const { data, error } = await supabase
    .from('portfolios')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export async function createPortfolio(name) {
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('portfolios')
    .insert({ name: name.trim(), user_id: user.id })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function renamePortfolio(id, name) {
  const { data, error } = await supabase
    .from('portfolios')
    .update({ name: name.trim() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deletePortfolio(id) {
  const { error } = await supabase.from('portfolios').delete().eq('id', id)
  if (error) throw error
}
