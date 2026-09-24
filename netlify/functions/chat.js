const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
};

exports.handler = async function(event, context) {
    // Xử lý preflight CORS request
    if (event.httpMethod === "OPTIONS") {
        return { statusCode: 200, headers, body: "" };
    }

    // Chỉ chấp nhận phương thức POST
    if (event.httpMethod !== "POST") {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: "Method Not Allowed" })
        };
    }

    try {
        let bodyObj = {};
        try {
            bodyObj = JSON.parse(event.body || "{}");
        } catch (e) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: "Dữ liệu gửi lên không đúng định dạng JSON." })
            };
        }

        const { prompt } = bodyObj;
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: "Chưa cấu hình GEMINI_API_KEY trên biến môi trường (Environment Variables) của Netlify." })
            };
        }

        // Gọi Google Gemini API từ phía server (hoàn toàn bảo mật) với các model fallback
        const models = [
            "gemini-2.5-flash",
            "gemini-2.0-flash",
            "gemini-1.5-flash",
            "gemini-1.5-flash-8b",
            "gemini-3.5-flash-lite",
            "gemini-3.5-flash"
        ];
        let aiResponse = "";
        let success = false;
        let lastError = "";

        for (const model of models) {
            try {
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
                    lastError = data.error?.message || `Lỗi từ model ${model}`;
                }
            } catch (fetchErr) {
                lastError = fetchErr.message;
            }
        }

        if (success) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ reply: aiResponse })
            };
        } else {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: lastError })
            };
        }
    } catch (err) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: err.message })
        };
    }
};