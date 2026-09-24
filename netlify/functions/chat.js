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

        // Gọi đồng thời các model nhanh nhất bằng Promise.any (Song song)
        // Model nào trả lời nhanh nhất (thường < 1-2s) sẽ được trả về ngay lập tức, triệt tiêu hoàn toàn lỗi Timeout 504.
        const models = [
            "gemini-1.5-flash",
            "gemini-2.0-flash",
            "gemini-1.5-flash-latest",
            "gemini-pro"
        ];

        const fetchPromises = models.map(async (model) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 7500); // 7.5s hard timeout

            try {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
                const res = await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);
                const data = await res.json();

                if (res.ok && data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
                    return data.candidates[0].content.parts[0].text;
                }
                throw new Error(data.error?.message || `Model ${model} trả về lỗi ${res.status}`);
            } catch (err) {
                clearTimeout(timeoutId);
                throw err;
            }
        });

        try {
            const aiResponse = await Promise.any(fetchPromises);
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ reply: aiResponse })
            };
        } catch (aggregateErr) {
            const errorDetails = aggregateErr.errors ? aggregateErr.errors.map(e => e.message).join(" ; ") : aggregateErr.message;
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: errorDetails || "Tất cả các model AI đều không phản hồi." })
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