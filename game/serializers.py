from rest_framework import serializers
from users.serializers import UserSerializer
from .models import Game, GamePlayer, Tournament, TournamentPlayer, TournamentMatch


class GamePlayerSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = GamePlayer
        fields = ('id', 'user', 'side', 'score', 'ready', 'connected', 'joined_at')
        read_only_fields = ('id', 'joined_at')


class GameSerializer(serializers.ModelSerializer):
    players = GamePlayerSerializer(many=True, read_only=True)

    class Meta:
        model = Game
        fields = ('id', 'status', 'created_at', 'updated_at', 'is_tournament', 'tournament_name',
                  'max_score', 'enable_powerups', 'ball_speed', 'paddle_size', 'players')
        read_only_fields = ('id', 'created_at', 'updated_at')


class CreateGameSerializer(serializers.ModelSerializer):
    class Meta:
        model = Game
        fields = ('max_score', 'enable_powerups', 'ball_speed', 'paddle_size')


class JoinGameSerializer(serializers.ModelSerializer):
    side = serializers.ChoiceField(choices=['left', 'right'])

    class Meta:
        model = GamePlayer
        fields = ('side',)


class TournamentPlayerSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = TournamentPlayer
        fields = ('id', 'user', 'joined_at', 'eliminated', 'current_position')
        read_only_fields = ('id', 'joined_at', 'eliminated', 'current_position')


class TournamentMatchSerializer(serializers.ModelSerializer):
    player1 = TournamentPlayerSerializer(read_only=True)
    player2 = TournamentPlayerSerializer(read_only=True)
    winner = TournamentPlayerSerializer(read_only=True)
    game = GameSerializer(read_only=True)

    class Meta:
        model = TournamentMatch
        fields = ('id', 'tournament', 'game', 'round_number', 'match_number',
                  'player1', 'player2', 'winner', 'next_match')
        read_only_fields = ('id', 'tournament', 'round_number', 'match_number',
                            'next_match')


class TournamentSerializer(serializers.ModelSerializer):
    created_by = UserSerializer(read_only=True)
    players = TournamentPlayerSerializer(many=True, read_only=True)
    matches = TournamentMatchSerializer(many=True, read_only=True)

    class Meta:
        model = Tournament
        fields = ('id', 'name', 'description', 'created_by', 'created_at', 'max_players',
                  'current_round', 'status', 'max_score', 'enable_powerups',
                  'players', 'matches')
        read_only_fields = ('id', 'created_at', 'current_round', 'status')


class CreateTournamentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tournament
        fields = ('name', 'description', 'max_players', 'max_score', 'enable_powerups')


class StartTournamentSerializer(serializers.Serializer):
    pass