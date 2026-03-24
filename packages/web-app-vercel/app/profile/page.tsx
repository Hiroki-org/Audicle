import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";

export default async function ProfilePage() {
  const session = await auth();
  if (!session) {
    redirect("/auth/signin");
  }

  return (
    <div className="h-screen bg-black text-white flex flex-col lg:flex-row">
      <Sidebar />

      <main className="flex-1 overflow-y-auto bg-gradient-to-b from-zinc-900 to-black">
        <div className="p-4 sm:p-6 lg:p-8">
          <div className="max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold mb-8">プロフィール</h1>

            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
              <div className="flex items-center gap-4 mb-6">
                {session.user?.image && (
                  <img
                    src={session.user.image}
                    alt="プロフィール画像"
                    className="w-16 h-16 rounded-full"
                  />
                )}
                <div>
                  <h2 className="text-xl font-semibold" data-testid="user-name">
                    {session.user?.name}
                  </h2>
                  <p className="text-zinc-400" data-testid="user-email">
                    {session.user?.email}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">
                    名前
                  </label>
                  <p className="text-white">{session.user?.name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">
                    メールアドレス
                  </label>
                  <p className="text-white">{session.user?.email}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
