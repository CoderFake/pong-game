import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from .models import ChatRoom, Message, DirectMessage, BlockedUser

User = get_user_model()


class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_name = self.scope['url_route']['kwargs']['room_name']
        self.room_group_name = f'chat_{self.room_name}'
        self.user = self.scope['user']

        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()

        # Send user list to new user
        user_list = await self.get_online_users()
        await self.send(text_data=json.dumps({
            'type': 'user_list',
            'users': user_list
        }))

        # Notify other users about new user
        if self.user.is_authenticated:
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'user_join',
                    'user': {
                        'id': self.user.id,
                        'username': self.user.username,
                        'display_name': self.user.display_name,
                        'avatar': self.user.avatar.url if self.user.avatar else None,
                        'is_online': True
                    }
                }
            )

        # Send recent messages
        messages = await self.get_recent_messages()
        await self.send(text_data=json.dumps({
            'type': 'recent_messages',
            'messages': messages
        }))

    async def disconnect(self, close_code):
        # Leave room group
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

        # Notify other users about user leaving
        if self.user.is_authenticated:
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'user_leave',
                    'user_id': self.user.id
                }
            )

    async def receive(self, text_data):
        data = json.loads(text_data)
        message_type = data.get('type')

        if message_type == 'chat_message':
            content = data.get('content')
            is_game_invite = data.get('is_game_invite', False)
            game_id = data.get('game_id') if is_game_invite else None

            # Store message in database
            message = await self.save_message(content, is_game_invite, game_id)

            # Send message to room group
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_message',
                    'message': message
                }
            )
        elif message_type == 'direct_message':
            recipient_id = data.get('recipient_id')
            content = data.get('content')
            is_game_invite = data.get('is_game_invite', False)
            game_id = data.get('game_id') if is_game_invite else None

            # Check if user is blocked
            is_blocked = await self.is_blocked(recipient_id)
            if is_blocked:
                await self.send(text_data=json.dumps({
                    'type': 'error',
                    'message': 'You have been blocked by this user or you have blocked them'
                }))
                return

            # Store message in database
            message = await self.save_direct_message(recipient_id, content, is_game_invite, game_id)

            # Send direct message to recipient and sender
            recipient_channel = f'user_{recipient_id}'
            await self.channel_layer.group_send(
                recipient_channel,
                {
                    'type': 'direct_message',
                    'message': message
                }
            )

            # Send confirmation to sender
            await self.send(text_data=json.dumps({
                'type': 'direct_message_sent',
                'message': message
            }))

    async def chat_message(self, event):
        message = event['message']

        # Send message to WebSocket
        await self.send(text_data=json.dumps({
            'type': 'chat_message',
            'message': message
        }))

    async def direct_message(self, event):
        message = event['message']

        # Send message to WebSocket
        await self.send(text_data=json.dumps({
            'type': 'direct_message',
            'message': message
        }))

    async def user_join(self, event):
        user = event['user']

        # Send user join notification to WebSocket
        await self.send(text_data=json.dumps({
            'type': 'user_join',
            'user': user
        }))

    async def user_leave(self, event):
        user_id = event['user_id']

        # Send user leave notification to WebSocket
        await self.send(text_data=json.dumps({
            'type': 'user_leave',
            'user_id': user_id
        }))

    @database_sync_to_async
    def get_online_users(self):
        return [
            {
                'id': user.id,
                'username': user.username,
                'display_name': user.display_name,
                'avatar': user.avatar.url if user.avatar else None,
                'is_online': user.is_online
            }
            for user in User.objects.filter(is_online=True)
        ]

    @database_sync_to_async
    def get_recent_messages(self):
        room, created = ChatRoom.objects.get_or_create(name=self.room_name)
        messages = Message.objects.filter(room=room).order_by('-created_at')[:50]

        return [
            {
                'id': message.id,
                'content': message.content,
                'sender': {
                    'id': message.sender.id,
                    'username': message.sender.username,
                    'display_name': message.sender.display_name,
                    'avatar': message.sender.avatar.url if message.sender.avatar else None
                },
                'created_at': message.created_at.isoformat(),
                'is_game_invite': message.is_game_invite
            }
            for message in reversed(messages)
        ]

    @database_sync_to_async
    def save_message(self, content, is_game_invite=False, game_id=None):
        if not self.user.is_authenticated:
            return None

        room, created = ChatRoom.objects.get_or_create(name=self.room_name)
        message = Message.objects.create(
            room=room,
            sender=self.user,
            content=content,
            is_game_invite=is_game_invite
        )

        return {
            'id': message.id,
            'content': message.content,
            'sender': {
                'id': message.sender.id,
                'username': message.sender.username,
                'display_name': message.sender.display_name,
                'avatar': message.sender.avatar.url if message.sender.avatar else None
            },
            'created_at': message.created_at.isoformat(),
            'is_game_invite': message.is_game_invite,
            'game_id': game_id
        }

    @database_sync_to_async
    def save_direct_message(self, recipient_id, content, is_game_invite=False, game_id=None):
        if not self.user.is_authenticated:
            return None

        try:
            recipient = User.objects.get(id=recipient_id)
            message = DirectMessage.objects.create(
                sender=self.user,
                recipient=recipient,
                content=content,
                is_game_invite=is_game_invite,
                game_id=game_id
            )

            return {
                'id': message.id,
                'content': message.content,
                'sender': {
                    'id': message.sender.id,
                    'username': message.sender.username,
                    'display_name': message.sender.display_name,
                    'avatar': message.sender.avatar.url if message.sender.avatar else None
                },
                'recipient': {
                    'id': message.recipient.id,
                    'username': message.recipient.username,
                    'display_name': message.recipient.display_name,
                    'avatar': message.recipient.avatar.url if message.recipient.avatar else None
                },
                'created_at': message.created_at.isoformat(),
                'read': message.read,
                'is_game_invite': message.is_game_invite,
                'game_id': message.game_id
            }
        except User.DoesNotExist:
            return None

    @database_sync_to_async
    def is_blocked(self, recipient_id):
        if not self.user.is_authenticated:
            return True

        try:
            recipient = User.objects.get(id=recipient_id)
            # Check if sender is blocked by recipient
            if BlockedUser.objects.filter(user=recipient, blocked_user=self.user).exists():
                return True

            # Check if recipient is blocked by sender
            if BlockedUser.objects.filter(user=self.user, blocked_user=recipient).exists():
                return True

            return False
        except User.DoesNotExist:
            return True


class DirectChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope['user']

        if not self.user.is_authenticated:
            await self.close()
            return

        self.user_group_name = f'user_{self.user.id}'

        # Join user group
        await self.channel_layer.group_add(
            self.user_group_name,
            self.channel_name
        )

        await self.accept()

        # Send unread messages
        unread_messages = await self.get_unread_messages()
        await self.send(text_data=json.dumps({
            'type': 'unread_messages',
            'messages': unread_messages
        }))

    async def disconnect(self, close_code):
        # Leave user group
        await self.channel_layer.group_discard(
            self.user_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        data = json.loads(text_data)
        message_type = data.get('type')

        if message_type == 'mark_read':
            message_id = data.get('message_id')
            await self.mark_message_read(message_id)

            # Send confirmation
            await self.send(text_data=json.dumps({
                'type': 'message_marked_read',
                'message_id': message_id
            }))
        elif message_type == 'block_user':
            blocked_user_id = data.get('user_id')
            await self.block_user(blocked_user_id)

            # Send confirmation
            await self.send(text_data=json.dumps({
                'type': 'user_blocked',
                'user_id': blocked_user_id
            }))
        elif message_type == 'unblock_user':
            unblocked_user_id = data.get('user_id')
            await self.unblock_user(unblocked_user_id)

            # Send confirmation
            await self.send(text_data=json.dumps({
                'type': 'user_unblocked',
                'user_id': unblocked_user_id
            }))

    async def direct_message(self, event):
        message = event['message']

        # Send message to WebSocket
        await self.send(text_data=json.dumps({
            'type': 'direct_message',
            'message': message
        }))

    @database_sync_to_async
    def get_unread_messages(self):
        messages = DirectMessage.objects.filter(recipient=self.user, read=False)

        return [
            {
                'id': message.id,
                'content': message.content,
                'sender': {
                    'id': message.sender.id,
                    'username': message.sender.username,
                    'display_name': message.sender.display_name,
                    'avatar': message.sender.avatar.url if message.sender.avatar else None
                },
                'created_at': message.created_at.isoformat(),
                'read': message.read,
                'is_game_invite': message.is_game_invite,
                'game_id': message.game_id
            }
            for message in messages
        ]

    @database_sync_to_async
    def mark_message_read(self, message_id):
        try:
            message = DirectMessage.objects.get(id=message_id, recipient=self.user)
            message.read = True
            message.save()
            return True
        except DirectMessage.DoesNotExist:
            return False

    @database_sync_to_async
    def block_user(self, blocked_user_id):
        try:
            blocked_user = User.objects.get(id=blocked_user_id)
            BlockedUser.objects.get_or_create(user=self.user, blocked_user=blocked_user)
            return True
        except User.DoesNotExist:
            return False

    @database_sync_to_async
    def unblock_user(self, unblocked_user_id):
        try:
            unblocked_user = User.objects.get(id=unblocked_user_id)
            BlockedUser.objects.filter(user=self.user, blocked_user=unblocked_user).delete()
            return True
        except User.DoesNotExist:
            return False