'use client'

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  type ChartData,
  type ChartOptions,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

interface LazyBarChartProps {
  data: ChartData<'bar'>
  options: ChartOptions<'bar'>
}

export function LazyBarChart({ data, options }: LazyBarChartProps) {
  return <Bar data={data} options={options} />
}
