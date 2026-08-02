import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils'
import { useOwedByPerson } from '@/features/splits/hooks'

export function OwedByPersonCard() {
  const { data: people, isLoading } = useOwedByPerson()

  if (isLoading) return <Skeleton className="h-24" />
  if (!people || people.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Who owes what</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {people.map((person) => (
          <div key={person.name} className="flex items-center justify-between text-sm">
            <span className="truncate">{person.name}</span>
            <span className="num font-medium">{formatCurrency(person.amount)}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
