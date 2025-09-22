import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getStripe } from '@/lib/stripe/server'
import { getCustomerIdByUid } from '@/lib/firebase/admin'

export async function GET(request: NextRequest) {
  try {
    // Use session authentication instead of Firebase token
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const uid = session.uid

    // Get Stripe customer ID
    const customerId = await getCustomerIdByUid(uid)
    if (!customerId) {
      // User doesn't have a Stripe customer yet, return empty invoices
      return NextResponse.json({ invoices: [] })
    }

    // Fetch invoices from Stripe
    const stripe = getStripe()
    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit: 100, // Get last 100 invoices
      expand: ['data.subscription'],
    })

    // Transform invoice data for client - filter out $0 test invoices
    const transformedInvoices = invoices.data
      .filter(invoice => {
        // Only show finalized invoices with actual amounts
        const amount = invoice.amount_paid || invoice.amount_due
        return invoice.status !== 'draft' && amount > 0
      })
      .map(invoice => ({
        id: invoice.id,
        amount: invoice.amount_paid || invoice.amount_due,
        currency: invoice.currency,
        status: invoice.status,
        created: new Date(invoice.created * 1000).toISOString(),
        invoicePdf: invoice.invoice_pdf,
        description: invoice.description || getInvoiceDescription(invoice),
        periodStart: invoice.period_start ? new Date(invoice.period_start * 1000).toISOString() : null,
        periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : null,
      }))

    return NextResponse.json({
      invoices: transformedInvoices,
      customerId
    })

  } catch (error) {
    console.error('Error fetching invoices:', error)
    return NextResponse.json(
      { error: 'Failed to fetch invoices' },
      { status: 500 }
    )
  }
}

function getInvoiceDescription(invoice: any): string {
  if (invoice.lines?.data?.[0]?.description) {
    return invoice.lines.data[0].description
  }
  
  if (invoice.subscription) {
    const sub = invoice.subscription
    const interval = sub.items?.data?.[0]?.price?.recurring?.interval
    if (interval === 'month') {
      return 'Monthly Subscription'
    } else if (interval === 'year') {
      return 'Annual Subscription'
    }
  }
  
  return 'Subscription'
}