import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from "recharts"
import { useState, useEffect } from "react"
import { onSnapshot, collection, query, getDocs, collectionGroup } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { auth } from "@/lib/firebase"

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042"]

export default function DonationReports({ timeFrame }) {
  const [donations, setDonations] = useState([])
  const [donationStats, setDonationStats] = useState({
    total: 0,
    breakdown: [],
    topDonors: []
  })

  useEffect(() => {
    // Get current year
    const currentYear = new Date().getFullYear().toString()
    
    const fetchDonations = async () => {
      try {
        const ngoId = auth.currentUser?.uid
        if (!ngoId) {
          console.log('No NGO ID found')
          return
        }

        console.log('Fetching donations for NGO:', ngoId)
        
        let allDonations = []

        // Fetch all cash donations using collectionGroup
        const cashDonations = await getDocs(collectionGroup(db, 'cash'))
        cashDonations.forEach(doc => {
          // Only include donations that belong to this NGO and year
          const path = doc.ref.path
          if (path.includes(`donations/${ngoId}/${currentYear}`)) {
            allDonations.push({ id: doc.id, ...doc.data(), paymentMethod: 'Cash' })
          }
        })

        // Fetch all online donations
        const onlineDonations = await getDocs(collectionGroup(db, 'online'))
        onlineDonations.forEach(doc => {
          // Only include donations that belong to this NGO and year
          const path = doc.ref.path
          if (path.includes(`donations/${ngoId}/${currentYear}`)) {
            allDonations.push({ id: doc.id, ...doc.data(), paymentMethod: 'Online' })
          }
        })

        // Fetch all crypto donations
        const cryptoDonations = await getDocs(collectionGroup(db, 'crypto'))
        cryptoDonations.forEach(doc => {
          // Only include donations that belong to this NGO and year
          const path = doc.ref.path
          if (path.includes(`donations/${ngoId}/${currentYear}`)) {
            allDonations.push({ id: doc.id, ...doc.data(), paymentMethod: 'Crypto' })
          }
        })

        console.log('Raw Donations Data:', allDonations)
        setDonations(allDonations)
        
        // Calculate statistics (excluding crypto)
        const total = allDonations
          .filter(donation => donation.paymentMethod !== 'Crypto')
          .reduce((sum, donation) => sum + Number(donation.amount || 0), 0)
        console.log('Total Donations (excluding crypto):', total)
        
        // Calculate breakdown by payment method
        const methodBreakdown = allDonations.reduce((acc, donation) => {
          const method = donation.paymentMethod || "Other"
          acc[method] = (acc[method] || 0) + Number(donation.amount || 0)
          return acc
        }, {})
        console.log('Payment Method Breakdown:', methodBreakdown)
        
        const breakdown = Object.entries(methodBreakdown).map(([method, amount]) => ({
          method,
          amount
        }))
        console.log('Formatted Breakdown Data:', breakdown)

        // Get top donors (excluding crypto)
        const topDonors = [...allDonations]
          .filter(donation => donation.paymentMethod !== 'Crypto')
          .sort((a, b) => Number(b.amount) - Number(a.amount))
          .slice(0, 3)
          .map(donor => ({
            name: donor.name || donor.donorName,
            amount: Number(donor.amount),
            date: donor.timestamp || donor.donatedOn
          }))
        console.log('Top Donors:', topDonors)

        const stats = {
          total,
          breakdown,
          topDonors
        }
        console.log('Final Donation Stats:', stats)
        setDonationStats(stats)
      } catch (error) {
        console.error('Error fetching donations:', error)
      }
    }

    fetchDonations()
  }, [])

  // Filter functions for different donation types
  const cashDonations = donations.filter(d => d.paymentMethod === 'Cash')
  const onlineDonations = donations.filter(d => d.paymentMethod === 'Online')
  const cryptoDonations = donations.filter(d => d.paymentMethod === 'Crypto')

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Donation Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold mb-4">Total Donations: ₹{donationStats.total.toLocaleString()}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Donation Breakdown</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Method</TableHead>
                    <TableHead>Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {donationStats.breakdown
                    .map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{item.method}</TableCell>
                        <TableCell>
                          {item.method === 'Crypto' 
                            ? item.amount.toLocaleString()  // No ₹ symbol for crypto
                            : `₹${item.amount.toLocaleString()}`  // Keep ₹ for other methods
                          }
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Donation Methods</h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donationStats.breakdown.filter(item => item.method !== 'Crypto')}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="amount"
                    >
                      {donationStats.breakdown
                        .filter(item => item.method !== 'Crypto')
                        .map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cash Donations</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Method</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cashDonations.slice(0, 5).map((donation, index) => (
                <TableRow key={donation.id}>
                  <TableCell>{donation.name}</TableCell>
                  <TableCell>₹{Number(donation.amount).toLocaleString()}</TableCell>
                  <TableCell>{donation.donatedOn}</TableCell>
                  <TableCell>{donation.paymentMethod}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>UPI Donations</CardTitle>
        </CardHeader>   
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Method</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {onlineDonations.slice(0, 5).map((donation, index) => (
                <TableRow key={donation.id}>
                  <TableCell>{donation.name}</TableCell>
                  <TableCell>₹{Number(donation.amount).toLocaleString()}</TableCell>
                  <TableCell>
                    {donation.id ? new Date(donation.id).toISOString().split('T')[0] : 'No date'}
                  </TableCell>
                  <TableCell>{donation.paymentMethod}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cryptocurrency Donations</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Tokens</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Method</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cryptoDonations.slice(0, 5).map((donation, index) => (
                <TableRow key={donation.id}>
                  <TableCell>{donation.name}</TableCell>
                  <TableCell>{donation.amount}</TableCell>
                  <TableCell>
                    {donation.id ? new Date(donation.id).toISOString().split('T')[0] : 'No date'}
                  </TableCell>
                  <TableCell>{donation.paymentMethod}</TableCell>
                  
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

