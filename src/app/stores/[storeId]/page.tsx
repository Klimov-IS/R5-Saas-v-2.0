import { redirect } from 'next/navigation';

export default function StoreRedirectPage({ params }: { params: { storeId: string } }) {
  redirect(`/stores/${params.storeId}/products`);
}
