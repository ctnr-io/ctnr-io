import { ScrollView, Text, XStack, YStack } from 'tamagui'
import { MainLayout } from '../components/MainLayout.tsx'
import { PageHeader } from '../components/PageHeader.tsx'
import { IconSymbol } from '../components/ui/IconSymbol.tsx'
import { CtnrColors } from '../constants/Colors.ts'

interface BillingItem {
  id: string
  service: string
  usage: string
  rate: string
  cost: number
}

interface Invoice {
  id: string
  period: string
  amount: number
  status: 'paid' | 'pending' | 'overdue'
  dueDate: string
}

function BillingCard({ title, amount, subtitle, icon, color = CtnrColors.primary }: {
  title: string
  amount: string
  subtitle?: string
  icon: string
  color?: string
}) {
  return (
    <YStack
      background='$background'
      style={{ borderRadius: 12 }}
      paddingInline='$4'
      paddingBlock='$4'
      borderWidth={1}
      borderColor='$borderColor'
      gap='$3'
      flex={1}
      minW={200}
    >
      <XStack verticalAlign='center' justify='space-between'>
        <YStack
          background={color}
          style={{ borderRadius: 8 }}
          width={40}
          height={40}
          verticalAlign='center'
          justify='center'
        >
          <IconSymbol name={icon as any} size={20} color={CtnrColors.white} />
        </YStack>
      </XStack>
      <YStack gap='$1'>
        <Text fontSize='$7' fontWeight='bold' color='$color' fontFamily='$heading'>
          {amount}
        </Text>
        <Text fontSize='$4' fontWeight='600' color='$color' fontFamily='$body'>
          {title}
        </Text>
        {subtitle && (
          <Text fontSize='$3' color={CtnrColors.textLight} fontFamily='$body'>
            {subtitle}
          </Text>
        )}
      </YStack>
    </YStack>
  )
}

function BillingItemRow({ item }: { item: BillingItem }) {
  return (
    <XStack
      paddingInline='$4'
      paddingBlock='$3'
      verticalAlign='center'
      gap='$4'
      borderBottomWidth={1}
      borderBottomColor='$borderColor'
    >
      <Text fontSize='$4' color='$color' fontFamily='$body' flex={1}>
        {item.service}
      </Text>
      <Text fontSize='$3' color={CtnrColors.textLight} fontFamily='$body' minW={120}>
        {item.usage}
      </Text>
      <Text fontSize='$3' color={CtnrColors.textLight} fontFamily='$body' minW={100}>
        {item.rate}
      </Text>
      <Text fontSize='$4' fontWeight='600' color='$color' fontFamily='$body' minW={80}>
        ${item.cost.toFixed(2)}
      </Text>
    </XStack>
  )
}

function InvoiceRow({ invoice }: { invoice: Invoice }) {
  const statusColors = {
    paid: CtnrColors.success,
    pending: CtnrColors.warning,
    overdue: CtnrColors.error,
  }

  return (
    <XStack
      paddingInline='$4'
      paddingBlock='$3'
      verticalAlign='center'
      gap='$4'
      borderBottomWidth={1}
      borderBottomColor='$borderColor'
      pressStyle={{ background: '$backgroundStrong' }}
    >
      <Text fontSize='$4' color='$color' fontFamily='$body' flex={1}>
        {invoice.period}
      </Text>
      <Text fontSize='$4' fontWeight='600' color='$color' fontFamily='$body' minW={100}>
        ${invoice.amount.toFixed(2)}
      </Text>
      <XStack
        background={statusColors[invoice.status]}
        paddingInline='$2'
        paddingBlock='$1'
        style={{ borderRadius: 12 }}
        verticalAlign='center'
        minW={80}
      >
        <Text fontSize='$2' color='white' fontWeight='600' fontFamily='$body'>
          {invoice.status.toUpperCase()}
        </Text>
      </XStack>
      <Text fontSize='$3' color={CtnrColors.textLight} fontFamily='$body' minW={100}>
        {invoice.dueDate}
      </Text>
    </XStack>
  )
}

export default function BillingScreen() {
  const currentBill: BillingItem[] = [
    { id: '1', service: 'Container Runtime', usage: '720 hours', rate: '$0.05/hour', cost: 36.00 },
    { id: '2', service: 'Storage', usage: '150 GB', rate: '$0.10/GB', cost: 15.00 },
    { id: '3', service: 'Network Transfer', usage: '50 GB', rate: '$0.09/GB', cost: 4.50 },
    { id: '4', service: 'Load Balancer', usage: '1 instance', rate: '$18.00/month', cost: 18.00 },
    { id: '5', service: 'Backup Storage', usage: '25 GB', rate: '$0.05/GB', cost: 1.25 },
  ]

  const invoices: Invoice[] = [
    { id: '1', period: 'January 2024', amount: 74.75, status: 'paid', dueDate: 'Feb 1, 2024' },
    { id: '2', period: 'December 2023', amount: 68.50, status: 'paid', dueDate: 'Jan 1, 2024' },
    { id: '3', period: 'November 2023', amount: 72.25, status: 'paid', dueDate: 'Dec 1, 2023' },
    { id: '4', period: 'October 2023', amount: 65.00, status: 'paid', dueDate: 'Nov 1, 2023' },
  ]

  const totalCurrentBill = currentBill.reduce((sum, item) => sum + item.cost, 0)

  return (
    <MainLayout>
      <PageHeader
        title='Billing'
        subtitle='Manage your subscription and view usage costs'
        icon='creditcard'
      />

      <ScrollView flex={1}>
        <YStack paddingInline='$6' paddingBlock='$6' gap='$6'>
          {/* Billing Overview */}
          <YStack gap='$4'>
            <Text fontSize='$6' fontWeight='bold' color='$color' fontFamily='$heading'>
              Billing Overview
            </Text>
            <XStack gap='$4' flexWrap='wrap'>
              <BillingCard
                title='Current Month'
                amount={`$${totalCurrentBill.toFixed(2)}`}
                subtitle='Estimated charges'
                icon='calendar'
                color={CtnrColors.primary}
              />
              <BillingCard
                title='Last Month'
                amount='$74.75'
                subtitle='Final charges'
                icon='checkmark.circle'
                color={CtnrColors.success}
              />
              <BillingCard
                title='Average Monthly'
                amount='$68.12'
                subtitle='Last 6 months'
                icon='chart.bar'
                color={CtnrColors.warning}
              />
              <BillingCard
                title='Next Payment'
                amount='Feb 1'
                subtitle='Auto-pay enabled'
                icon='creditcard'
                color={CtnrColors.secondary}
              />
            </XStack>
          </YStack>

          {/* Current Month Usage */}
          <YStack gap='$4'>
            <Text fontSize='$6' fontWeight='bold' color='$color' fontFamily='$heading'>
              Current Month Usage
            </Text>
            <YStack
              background='$background'
              style={{ borderRadius: 12 }}
              borderWidth={1}
              borderColor='$borderColor'
              overflow='hidden'
            >
              {/* Header */}
              <XStack
                paddingInline='$4'
                paddingBlock='$3'
                borderBottomWidth={1}
                borderBottomColor='$borderColor'
                background='$backgroundStrong'
              >
                <Text fontSize='$3' fontWeight='600' color={CtnrColors.textLight} fontFamily='$body' flex={1}>
                  SERVICE
                </Text>
                <Text fontSize='$3' fontWeight='600' color={CtnrColors.textLight} fontFamily='$body' minW={120}>
                  USAGE
                </Text>
                <Text fontSize='$3' fontWeight='600' color={CtnrColors.textLight} fontFamily='$body' minW={100}>
                  RATE
                </Text>
                <Text fontSize='$3' fontWeight='600' color={CtnrColors.textLight} fontFamily='$body' minW={80}>
                  COST
                </Text>
              </XStack>
              
              {/* Items */}
              {currentBill.map((item) => (
                <BillingItemRow key={item.id} item={item} />
              ))}
              
              {/* Total */}
              <XStack
                paddingInline='$4'
                paddingBlock='$3'
                borderTopWidth={1}
                borderTopColor='$borderColor'
                background='$backgroundStrong'
              >
                <Text fontSize='$4' fontWeight='bold' color='$color' fontFamily='$body' flex={1}>
                  Total Estimated
                </Text>
                <Text fontSize='$5' fontWeight='bold' color='$color' fontFamily='$heading' minW={80}>
                  ${totalCurrentBill.toFixed(2)}
                </Text>
              </XStack>
            </YStack>
          </YStack>

          {/* Payment Method */}
          <YStack gap='$4'>
            <Text fontSize='$6' fontWeight='bold' color='$color' fontFamily='$heading'>
              Payment Method
            </Text>
            <YStack
              background='$background'
              style={{ borderRadius: 12 }}
              paddingInline='$4'
              paddingBlock='$4'
              borderWidth={1}
              borderColor='$borderColor'
              gap='$3'
            >
              <XStack verticalAlign='center' gap='$3'>
                <YStack
                  background='$primary'
                  style={{ borderRadius: 8 }}
                  width={40}
                  height={40}
                  verticalAlign='center'
                  justify='center'
                >
                  <IconSymbol name='creditcard' size={20} color={CtnrColors.white} />
                </YStack>
                <YStack gap='$1'>
                  <Text fontSize='$4' fontWeight='600' color='$color' fontFamily='$body'>
                    •••• •••• •••• 4242
                  </Text>
                  <Text fontSize='$3' color={CtnrColors.textLight} fontFamily='$body'>
                    Expires 12/25 • Auto-pay enabled
                  </Text>
                </YStack>
              </XStack>
            </YStack>
          </YStack>

          {/* Invoice History */}
          <YStack gap='$4'>
            <Text fontSize='$6' fontWeight='bold' color='$color' fontFamily='$heading'>
              Invoice History
            </Text>
            <YStack
              background='$background'
              style={{ borderRadius: 12 }}
              borderWidth={1}
              borderColor='$borderColor'
              overflow='hidden'
            >
              {/* Header */}
              <XStack
                paddingInline='$4'
                paddingBlock='$3'
                borderBottomWidth={1}
                borderBottomColor='$borderColor'
                background='$backgroundStrong'
              >
                <Text fontSize='$3' fontWeight='600' color={CtnrColors.textLight} fontFamily='$body' flex={1}>
                  PERIOD
                </Text>
                <Text fontSize='$3' fontWeight='600' color={CtnrColors.textLight} fontFamily='$body' minW={100}>
                  AMOUNT
                </Text>
                <Text fontSize='$3' fontWeight='600' color={CtnrColors.textLight} fontFamily='$body' minW={80}>
                  STATUS
                </Text>
                <Text fontSize='$3' fontWeight='600' color={CtnrColors.textLight} fontFamily='$body' minW={100}>
                  DUE DATE
                </Text>
              </XStack>
              
              {/* Invoices */}
              {invoices.map((invoice) => (
                <InvoiceRow key={invoice.id} invoice={invoice} />
              ))}
            </YStack>
          </YStack>
        </YStack>
      </ScrollView>
    </MainLayout>
  )
}
