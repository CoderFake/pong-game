/**
 * File: static/js/pong-ai.js
 * Mô tả: Class quản lý AI cho trò chơi Pong
 */

class PongAI {
    constructor(options = {}) {
        // Các thiết lập độ khó
        this.difficulty = options.difficulty || 'medium';

        // Kích thước và vị trí paddle
        this.paddleHeight = options.paddleHeight || 100;
        this.paddleY = options.initialY || 250;
        this.fieldHeight = options.fieldHeight || 500;
        this.fieldWidth = options.fieldWidth || 800;

        // Lưu trữ thông tin bóng để dự đoán
        this.ballHistory = [];
        this.maxHistory = 10; // Số điểm lưu trữ để dự đoán

        // Trạng thái dự đoán
        this.targetY = this.paddleY;
        this.predictedY = null;
        this.lastPredictionTime = 0;

        // Thiết lập thông số dựa trên độ khó
        this.setupDifficulty();

        // Trạng thái học tập đơn giản
        this.learningRate = 0.1;
        this.successes = 0;
        this.mistakes = 0;
        this.lastHitSuccess = false;
    }

    // Thiết lập thông số dựa vào độ khó
    setupDifficulty() {
        switch (this.difficulty) {
            case 'easy':
                this.reactionTime = 1000; // 1 giây
                this.errorMargin = 40;    // Lỗi dự đoán lớn
                this.predictionSkill = 0.6; // Khả năng dự đoán kém
                this.maxSpeed = 3;        // Di chuyển chậm
                this.anticipationFactor = 0.3; // Khả năng dự đoán bật bóng thấp
                break;

            case 'medium':
                this.reactionTime = 700;  // 0.7 giây
                this.errorMargin = 20;
                this.predictionSkill = 0.8;
                this.maxSpeed = 5;
                this.anticipationFactor = 0.6;
                break;

            case 'hard':
                this.reactionTime = 500;  // 0.5 giây
                this.errorMargin = 10;    // Lỗi dự đoán nhỏ
                this.predictionSkill = 0.95; // Khả năng dự đoán gần như hoàn hảo
                this.maxSpeed = 7;        // Di chuyển nhanh
                this.anticipationFactor = 0.9; // Khả năng dự đoán bật bóng cao
                break;

            default:
                this.reactionTime = 700;
                this.errorMargin = 20;
                this.predictionSkill = 0.8;
                this.maxSpeed = 5;
                this.anticipationFactor = 0.6;
        }
    }

    // Cập nhật vị trí paddle của AI
    update(ballX, ballY, ballSpeedX, ballSpeedY, currentTime) {
        // Thêm thông tin bóng vào lịch sử để phân tích
        this.updateBallHistory(ballX, ballY, ballSpeedX, ballSpeedY);

        // Chỉ cập nhật khi đủ thời gian phản ứng
        if (currentTime - this.lastPredictionTime < this.reactionTime) {
            return this.moveTowardsTarget();
        }

        // Cập nhật thời gian dự đoán
        this.lastPredictionTime = currentTime;

        // Dự đoán vị trí bóng khi đến paddle
        if (ballSpeedX > 0) { // Bóng đang di chuyển về phía AI (phải)
            this.predictBallPosition(ballX, ballY, ballSpeedX, ballSpeedY);
        } else {
            // Khi bóng đi ngược lại, AI di chuyển về vị trí trung tâm
            this.targetY = this.fieldHeight / 2;
        }

        return this.moveTowardsTarget();
    }

    // Cập nhật lịch sử bóng
    updateBallHistory(ballX, ballY, ballSpeedX, ballSpeedY) {
        this.ballHistory.push({
            x: ballX,
            y: ballY,
            dx: ballSpeedX,
            dy: ballSpeedY,
            timestamp: Date.now()
        });

        if (this.ballHistory.length > this.maxHistory) {
            this.ballHistory.shift();
        }
    }

    // Di chuyển về phía mục tiêu với tốc độ giới hạn
    moveTowardsTarget() {
        const paddleCenter = this.paddleY + this.paddleHeight / 2;
        const distance = this.targetY - paddleCenter;

        if (Math.abs(distance) > this.maxSpeed) {
            // Di chuyển với tốc độ tối đa
            this.paddleY += Math.sign(distance) * this.maxSpeed;
        } else {
            // Di chuyển trực tiếp đến vị trí mục tiêu
            this.paddleY = this.targetY - this.paddleHeight / 2;
        }

        // Giới hạn paddle trong khoảng hợp lệ
        this.paddleY = Math.max(0, Math.min(this.fieldHeight - this.paddleHeight, this.paddleY));

        return this.paddleY;
    }

    // Dự đoán vị trí bóng khi chạm đến paddle phải
    predictBallPosition(ballX, ballY, ballSpeedX, ballSpeedY) {
        if (ballSpeedX <= 0) return; // Bóng đang di chuyển về phía khác

        // Phân tích quỹ đạo bóng
        const trajectory = this.analyzeBallTrajectory();

        // Vị trí paddle phải
        const rightSideX = this.fieldWidth - 20 - 10; // paddle width + ball radius

        // Tính toán thời gian để bóng đến paddle phải
        const timeToReach = (rightSideX - ballX) / ballSpeedX;

        // Tính toán vị trí y của bóng khi đến paddle
        let predictedY = ballY + (ballSpeedY * timeToReach);

        // Xử lý các lần nảy trên tường
        predictedY = this.calculateBouncePosition(predictedY);

        // Áp dụng điều chỉnh dựa trên phân tích quỹ đạo
        if (trajectory.accelerating) {
            // Bóng đang tăng tốc, điều chỉnh dự đoán
            predictedY += trajectory.acceleration * timeToReach * this.anticipationFactor;
        }

        // Áp dụng độ chính xác dự đoán dựa vào độ khó
        if (Math.random() > this.predictionSkill) {
            const errorAmount = (Math.random() * 2 - 1) * this.errorMargin;
            predictedY += errorAmount;
        }

        // Học hỏi từ các lần dự đoán trước
        if (this.lastHitSuccess) {
            // Nếu lần trước thành công, tăng độ tin cậy của dự đoán
            this.targetY = predictedY * (1 + this.learningRate) - this.paddleHeight / 2;
        } else {
            // Nếu lần trước thất bại, điều chỉnh ngược lại
            this.targetY = predictedY * (1 - this.learningRate) - this.paddleHeight / 2;
        }

        // Lưu giá trị dự đoán
        this.predictedY = predictedY;

        // Đảm bảo targetY hợp lệ
        this.targetY = Math.max(this.paddleHeight / 2, Math.min(this.fieldHeight - this.paddleHeight / 2, this.targetY));
    }

    // Tính toán vị trí sau khi nảy
    calculateBouncePosition(predictedY) {
        // Xử lý các trường hợp nảy
        while (predictedY < 0 || predictedY > this.fieldHeight) {
            if (predictedY < 0) {
                predictedY = -predictedY; // Nảy ở tường trên
            } else if (predictedY > this.fieldHeight) {
                predictedY = 2 * this.fieldHeight - predictedY; // Nảy ở tường dưới
            }
        }

        return predictedY;
    }

    // Phân tích quỹ đạo bóng dựa trên lịch sử
    analyzeBallTrajectory() {
        if (this.ballHistory.length < 3) {
            return { accelerating: false, acceleration: 0 };
        }

        // Lấy 3 mẫu gần nhất
        const recent = this.ballHistory.slice(-3);

        // Tính toán thay đổi vận tốc
        const dvX1 = recent[1].dx - recent[0].dx;
        const dvX2 = recent[2].dx - recent[1].dx;
        const dvY1 = recent[1].dy - recent[0].dy;
        const dvY2 = recent[2].dy - recent[1].dy;

        // Xác định có đang tăng tốc không
        const acceleratingX = Math.abs(dvX2) > Math.abs(dvX1);
        const acceleratingY = Math.abs(dvY2) > Math.abs(dvY1);

        return {
            accelerating: acceleratingX || acceleratingY,
            acceleration: Math.max(Math.abs(dvY2), Math.abs(dvX2))
        };
    }

    // Phản hồi khi va chạm thành công
    recordHit() {
        this.lastHitSuccess = true;
        this.successes++;

        // Tăng độ chính xác dự đoán nhưng không quá 0.99
        this.predictionSkill = Math.min(0.99, this.predictionSkill + 0.01);
    }

    // Phản hồi khi bỏ lỡ bóng
    recordMiss() {
        this.lastHitSuccess = false;
        this.mistakes++;

        // Điều chỉnh chiến lược
        if (this.mistakes > this.successes) {
            // Nghiêng về giữa sân nếu có nhiều lỗi
            this.targetY = this.fieldHeight / 2;
        }
    }

    // Đặt lại AI
    reset(initialY) {
        this.paddleY = initialY || this.fieldHeight / 2 - this.paddleHeight / 2;
        this.targetY = this.paddleY;
        this.predictedY = null;
        this.ballHistory = [];
        this.lastPredictionTime = 0;
        this.successes = 0;
        this.mistakes = 0;
        this.lastHitSuccess = false;
    }
}