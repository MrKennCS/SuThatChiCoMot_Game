exports.handler = async function(event, context) {
    // Chỉ chấp nhận phương thức POST
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    try {
        const { prompt } = JSON.parse(event.body);
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return {
                statusCode: 500,
                body: JSON.stringify({ error: "Chưa cấu hình GEMINI_API_KEY trên máy chủ Netlify." })
            };
        }

        // Gọi Google Gemini API từ phía server (hoàn toàn bảo mật) với các model fallback
        const models = [
            "gemini-3.5-flash-lite",
            "gemini-3.5-flash",
            "gemini-2.5-flash",
            "gemini-2.0-flash",
            "gemini-1.5-flash",
            "gemini-1.5-flash-8b"
        ];
        let aiResponse = "";
        let success = false;
        let lastError = "";

        for (const model of models) {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });

            const data = await res.json();
            if (res.ok && data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
                aiResponse = data.candidates[0].content.parts[0].text;
                success = true;
                break;
            } else {
                lastError = data.error?.message || "Lỗi phản hồi từ Gemini API";
            }
        }

        if (success) {
            return {
                statusCode: 200,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reply: aiResponse })
            };
        } else {
            return {
                statusCode: 500,
                body: JSON.stringify({ error: lastError })
            };
        }
    } catch (err) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message })
        };
    }
};