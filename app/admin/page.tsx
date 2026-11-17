import { redirect } from 'next/navigation';

// Admin opens from the account menu now; the old entry point just forwards.
export default function AdminIndex() {
  redirect('/admin/dashboard');
}
