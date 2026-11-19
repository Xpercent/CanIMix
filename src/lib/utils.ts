import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** 合并类名：clsx 处理条件，tailwind-merge 处理冲突（后写的赢） */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
