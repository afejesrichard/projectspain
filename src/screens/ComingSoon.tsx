import { EmptyState } from '../components/primitives'

// Placeholder for a module whose screens land in a later phase. It loads no
// data and opens no channel.
export function ComingSoon({ title }: { title: string }) {
  return <EmptyState title={`${title}: hamarosan`} hint="Addig a Claude-os nézet marad a forrás." />
}
