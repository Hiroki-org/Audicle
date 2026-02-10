import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { initializeNewUser } from "./user-initialization";

// デバッグログは開発/テスト環境のみ
const IS_DEBUG = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'

// 診断ログ
console.log('[AUTH DIAGNOSTIC] NODE_ENV:', process.env.NODE_ENV)
console.log('[AUTH DIAGNOSTIC] IS_DEBUG:', IS_DEBUG)
console.log('[AUTH DIAGNOSTIC] TEST_USER_EMAIL:', process.env.TEST_USER_EMAIL ? 'SET' : 'NOT SET')
console.log('[AUTH DIAGNOSTIC] TEST_USER_PASSWORD:', process.env.TEST_USER_PASSWORD ? 'SET' : 'NOT SET')

const allowedUsers = process.env.ALLOWED_USERS?.split(',').map(email => email.trim()) || [];

export const { handlers, auth, signIn, signOut } = NextAuth({
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            authorization: {
                params: {
                    prompt: 'select_account',
                },
            },
        }),
        // テスト環境でのみ有効
        ...(process.env.NODE_ENV !== 'production' && process.env.AUTH_ENV === 'test'
            ? [
                CredentialsProvider({
                    id: 'test-credentials',
                    name: 'Test Credentials',
                    credentials: {
                        email: { label: "Email", type: "email" },
                        password: { label: "Password", type: "password" }
                    },
                    async authorize(credentials) {
                        if (IS_DEBUG) {
                            console.log('[AUTH DEBUG] Test credentials provider called')
                            console.log('[AUTH DEBUG] Credentials Provider check')
                            console.log('[AUTH DEBUG] NODE_ENV === "test":', process.env.NODE_ENV === 'test')
                        }

                        // テスト用の固定認証
                        if (
                            credentials?.email === process.env.TEST_USER_EMAIL &&
                            credentials?.password === process.env.TEST_USER_PASSWORD
                        ) {
                            if (IS_DEBUG) {
                                console.log('[AUTH DEBUG] Login SUCCESS')
                            }
                            return {
                                id: 'test-user-id-123',
                                name: 'Test User',
                                email: process.env.TEST_USER_EMAIL,
                            }
                        }
                        if (IS_DEBUG) {
                            console.log('[AUTH DEBUG] Login FAILED')
                        }
                        return null
                    }
                })
            ]
            : [])
    ],
    callbacks: {
        async signIn({ user }) {
            // テスト用ユーザーはホワイトリストチェックをスキップ
            if (process.env.NODE_ENV !== 'production' && process.env.AUTH_ENV === 'test' && user.id === 'test-user-id-123') {
                if (IS_DEBUG) {
                    console.log('[AUTH DEBUG] Test user - skipping whitelist check')
                }
                // テスト用ユーザーの初期化処理
                await initializeNewUser(user.id, user.email || '');
                return true
            }

            const email = user.email;
            if (!email) {
                throw new Error('NO_EMAIL: メールアドレスが取得できませんでした');
            }
            const isAllowed = allowedUsers.includes(email);
            if (IS_DEBUG) {
                console.log('[AUTH DEBUG] SignIn attempt:', email, 'Allowed:', isAllowed)
            }

            if (!isAllowed) {
                // エラーメッセージをURLパラメータで渡す
                const errorMessage = `ACCESS_DENIED: ${email}`;
                throw new Error(errorMessage);
            }
            return true;
        },
        async jwt({ token, account, profile }) {
            if (account) {
                token.id = profile?.sub || account.providerAccountId;
            }

            // 新規・既存問わず、常に初期化チェックを実行
            // initializeNewUser内で存在チェックするため、既存ユーザーはスキップされる
            await initializeNewUser(token.id as string, profile?.email || '');

            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                if (typeof token.id !== 'string') {
                    throw new Error('User ID not found in token.');
                }
                session.user.id = token.id;
            }
            return session;
        },
    },
    pages: {
        signIn: '/auth/signin',
        error: '/auth/error',
    },
    trustHost: true,
});