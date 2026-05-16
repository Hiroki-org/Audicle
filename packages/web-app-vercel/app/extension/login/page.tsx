import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { validateExtensionRedirectUri } from '@/lib/extension-auth';

type ExtensionLoginPageProps = {
    searchParams: Promise<{ redirect_uri?: string }>;
};

export default async function ExtensionLoginPage({ searchParams }: ExtensionLoginPageProps) {
    const { redirect_uri: redirectUri } = await searchParams;

    if (!redirectUri || !validateExtensionRedirectUri(redirectUri)) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-100 px-6">
                <div className="max-w-md rounded-lg border border-zinc-800 bg-zinc-900 p-6">
                    <h1 className="text-xl font-semibold">拡張機能ログイン</h1>
                    <p className="mt-3 text-sm text-zinc-300">redirect_uri が不正です。拡張機能から再度ログインを実行してください。</p>
                </div>
            </main>
        );
    }

    const session = await auth();
    if (!session?.user?.email || !session.user.id) {
        const callbackUrl = `/extension/login?redirect_uri=${encodeURIComponent(redirectUri)}`;
        redirect(`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
    }

    redirect(`/api/extension/token?redirect_uri=${encodeURIComponent(redirectUri)}`);
}
