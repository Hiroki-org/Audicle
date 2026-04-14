const { execSync } = require('child_process');

// Prepare the replies JSON string using raw Node string templating to avoid escaping issues
const replies = JSON.stringify([
    {
        comment_id: "3077555839",
        reply: "承知いたしました。現状での追加対応は見送りとし、作業を停止します。"
    },
    {
        comment_id: "3077556009",
        reply: "承知いたしました。ご指示に従い、本PRでの追加対応は見送りとさせていただきます。"
    }
]);

console.log(replies);
