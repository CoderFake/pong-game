class PongAI:
    def __init__(self, difficulty='medium'):
        self.difficulty = difficulty
        self.paddle_height = 100
        self.paddle_y = 250
        self.target_y = 250
        self.ball_prediction = None
        self.last_update_time = 0
        self.ball_history = []
        self.max_history = 5
        self.field_height = 500

        # Difficulty settings
        if difficulty == 'easy':
            self.reaction_time = 1.0
            self.error_margin = 40
            self.prediction_skill = 0.6
            self.max_speed = 3
        elif difficulty == 'medium':
            self.reaction_time = 0.7
            self.error_margin = 20
            self.prediction_skill = 0.8
            self.max_speed = 5
        else:  # Hard
            self.reaction_time = 0.5
            self.error_margin = 10
            self.prediction_skill = 0.95
            self.max_speed = 7

    def update(self, ball_x, ball_y, ball_dx, ball_dy, current_time):
        """Update AI with current ball position and calculate next move"""

        # Only update once per second to simulate human-like reaction time
        if current_time - self.last_update_time < self.reaction_time:
            return self.paddle_y

        self.last_update_time = current_time

        # Add ball position to history
        self.ball_history.append((ball_x, ball_y, ball_dx, ball_dy))
        if len(self.ball_history) > self.max_history:
            self.ball_history.pop(0)

        # Predict where ball will be when it reaches AI's side
        if ball_dx > 0:  # Ball is moving toward AI
            self._predict_ball_position(ball_x, ball_y, ball_dx, ball_dy)

        # Move paddle toward predicted position with some 'skill' factor
        if self.ball_prediction is not None:
            target_y = self.ball_prediction

            # Add some error based on difficulty
            import random
            error = random.uniform(-self.error_margin, self.error_margin)
            target_y += error

            # Clamp to field boundaries
            target_y = max(self.paddle_height / 2, min(self.field_height - self.paddle_height / 2, target_y))

            self.target_y = target_y

        # Move toward target at limited speed
        if abs(self.target_y - self.paddle_y) > self.max_speed:
            if self.target_y > self.paddle_y:
                self.paddle_y += self.max_speed
            else:
                self.paddle_y -= self.max_speed
        else:
            self.paddle_y = self.target_y

        return self.paddle_y

    def _predict_ball_position(self, ball_x, ball_y, ball_dx, ball_dy):
        """Predict where the ball will be when it reaches the AI's paddle"""

        # Simple prediction logic
        if ball_dx <= 0:
            return  # Ball moving away

        # Calculate time for ball to reach right side
        # This is a simplified calculation and doesn't account for bounces
        right_side_x = 800  # Assuming field width is 800
        time_to_reach = (right_side_x - ball_x) / ball_dx

        # Calculate y position at that time
        predicted_y = ball_y + (ball_dy * time_to_reach)

        # Account for bounces
        while predicted_y < 0 or predicted_y > self.field_height:
            if predicted_y < 0:
                predicted_y = -predicted_y
            elif predicted_y > self.field_height:
                predicted_y = 2 * self.field_height - predicted_y

        # Apply skill factor - higher prediction_skill means more accurate prediction
        if self.prediction_skill < 1.0:
            import random
            skill_error = random.uniform(0, 1.0 - self.prediction_skill) * self.field_height
            if random.random() > 0.5:
                skill_error = -skill_error
            predicted_y += skill_error

        self.ball_prediction = predicted_y