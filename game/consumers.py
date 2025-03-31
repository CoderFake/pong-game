import json
import time

from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import Game, GamePlayer
from django.contrib.auth import get_user_model

User = get_user_model()


class GameConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.game_id = self.scope['url_route']['kwargs']['game_id']
        self.game_group_name = f'game_{self.game_id}'
        self.user = self.scope['user']

        if await self.is_ai_game():
            self.ai = await self.initialize_ai()

        await self.channel_layer.group_add(
            self.game_group_name,
            self.channel_name
        )
        if self.user.is_authenticated:
            await self.set_player_connected(True)

            await self.channel_layer.group_send(
                self.game_group_name,
                {
                    'type': 'player_status',
                    'user_id': self.user.id,
                    'connected': True
                }
            )

        await self.accept()

    async def disconnect(self, close_code):
        if self.user.is_authenticated:
            # Mark player as disconnected
            await self.set_player_connected(False)

            await self.channel_layer.group_send(
                self.game_group_name,
                {
                    'type': 'player_status',
                    'user_id': self.user.id,
                    'connected': False
                }
            )

        await self.channel_layer.group_discard(
            self.game_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        data = json.loads(text_data)
        message_type = data.get('type')

        if message_type == 'game_update' and hasattr(self, 'ai'):
            game_state = data.get('game_state')
            if game_state and 'ball' in game_state:
                ball = game_state['ball']

                current_time = time.time()
                ai_y = self.ai.update(
                    ball['x'], ball['y'],
                    ball['speedX'], ball['speedY'],
                    current_time
                )

                await self.channel_layer.group_send(
                    self.game_group_name,
                    {
                        'type': 'ai_move',
                        'y_position': ai_y,
                        'timestamp': current_time
                    }
                )

        if message_type == 'powerup_pickup':
            await self.channel_layer.group_send(
                self.game_group_name,
                {
                    'type': 'powerup_activated',
                    'powerup_type': data.get('powerup_type'),
                    'player_side': data.get('player_side'),
                    'duration': data.get('duration')
                }
            )

        if message_type == 'game_update':
            await self.channel_layer.group_send(
                self.game_group_name,
                {
                    'type': 'game_update',
                    'game_state': data.get('game_state'),
                    'timestamp': data.get('timestamp')
                }
            )
        elif message_type == 'paddle_move':
            await self.channel_layer.group_send(
                self.game_group_name,
                {
                    'type': 'paddle_move',
                    'user_id': self.user.id,
                    'y_position': data.get('y_position'),
                    'timestamp': data.get('timestamp')
                }
            )
        elif message_type == 'goal_scored':
            await self.update_score(
                data.get('scoring_side'),
                data.get('left_score'),
                data.get('right_score')
            )

            await self.channel_layer.group_send(
                self.game_group_name,
                {
                    'type': 'goal_scored',
                    'scoring_side': data.get('scoring_side'),
                    'left_score': data.get('left_score'),
                    'right_score': data.get('right_score')
                }
            )
        elif message_type == 'game_ready':
            if self.user.is_authenticated:
                await self.set_player_ready()

                is_all_ready = await self.check_all_ready()

                if is_all_ready:
                    await self.channel_layer.group_send(
                        self.game_group_name,
                        {
                            'type': 'all_ready'
                        }
                    )
                else:
                    await self.channel_layer.group_send(
                        self.game_group_name,
                        {
                            'type': 'player_ready',
                            'user_id': self.user.id
                        }
                    )

    async def game_update(self, event):
        await self.send(text_data=json.dumps({
            'type': 'game_update',
            'game_state': event['game_state'],
            'timestamp': event['timestamp']
        }))

    async def paddle_move(self, event):
        await self.send(text_data=json.dumps({
            'type': 'paddle_move',
            'user_id': event['user_id'],
            'y_position': event['y_position'],
            'timestamp': event['timestamp']
        }))

    async def goal_scored(self, event):
        await self.send(text_data=json.dumps({
            'type': 'goal_scored',
            'scoring_side': event['scoring_side'],
            'left_score': event['left_score'],
            'right_score': event['right_score']
        }))

    async def player_status(self, event):
        await self.send(text_data=json.dumps({
            'type': 'player_status',
            'user_id': event['user_id'],
            'connected': event['connected']
        }))

    async def player_ready(self, event):
        await self.send(text_data=json.dumps({
            'type': 'player_ready',
            'user_id': event['user_id']
        }))

    async def all_ready(self, event):
        await self.send(text_data=json.dumps({
            'type': 'all_ready'
        }))

    # Cần thêm vào GameConsumer
    async def ai_move(self, event):
        """Xử lý di chuyển từ AI nếu chơi với máy"""
        await self.send(text_data=json.dumps({
            'type': 'ai_move',
            'y_position': event['y_position'],
            'timestamp': event['timestamp']
        }))

    async def powerup_activated(self, event):
        """Thông báo khi power-up được kích hoạt"""
        await self.send(text_data=json.dumps({
            'type': 'powerup_activated',
            'powerup_type': event['powerup_type'],
            'player_side': event['player_side'],
            'duration': event['duration']
        }))

    @database_sync_to_async
    def is_ai_game(self):
        try:
            game = Game.objects.get(id=self.game_id)
            return game.ai_enabled
        except Game.DoesNotExist:
            return False

    @database_sync_to_async
    def set_player_connected(self, connected):
        try:
            game = Game.objects.get(id=self.game_id)
            player = GamePlayer.objects.get(game=game, user=self.user)
            player.connected = connected
            player.save()
            return True
        except (Game.DoesNotExist, GamePlayer.DoesNotExist):
            return False

    @database_sync_to_async
    def initialize_ai(self):
        try:
            game = Game.objects.get(id=self.game_id)
            from .ai import PongAI
            return PongAI(
                difficulty=game.ai_difficulty,
                field_height=500,
                field_width=800
            )
        except Game.DoesNotExist:
            return None

    @database_sync_to_async
    def set_player_ready(self):
        try:
            game = Game.objects.get(id=self.game_id)
            player = GamePlayer.objects.get(game=game, user=self.user)
            player.ready = True
            player.save()
            return True
        except (Game.DoesNotExist, GamePlayer.DoesNotExist):
            return False

    @database_sync_to_async
    def check_all_ready(self):
        try:
            game = Game.objects.get(id=self.game_id)
            return all(player.ready for player in game.players.all())
        except Game.DoesNotExist:
            return False

    @database_sync_to_async
    def update_score(self, scoring_side, left_score, right_score):
        try:
            game = Game.objects.get(id=self.game_id)

            for player in game.players.all():
                if player.side == 'left':
                    player.score = left_score
                elif player.side == 'right':
                    player.score = right_score
                player.save()

            if left_score >= game.max_score or right_score >= game.max_score:
                game.status = 'finished'
                game.save()

                from users.models import Match

                left_player = GamePlayer.objects.get(game=game, side='left')
                right_player = GamePlayer.objects.get(game=game, side='right')

                match = Match.objects.create(
                    player1=left_player.user,
                    player2=right_player.user,
                    player1_score=left_score,
                    player2_score=right_score,
                    is_tournament=game.is_tournament,
                    tournament_name=game.tournament_name,
                    is_finished=True
                )

                if left_score > right_score:
                    left_player.user.wins += 1
                    right_player.user.losses += 1
                else:
                    right_player.user.wins += 1
                    left_player.user.losses += 1

                left_player.user.save()
                right_player.user.save()

            return True
        except (Game.DoesNotExist, GamePlayer.DoesNotExist):
            return False