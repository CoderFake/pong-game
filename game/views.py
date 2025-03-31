from rest_framework import viewsets, permissions, status, generics
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView

from .models import Game, GamePlayer, Tournament, TournamentPlayer, TournamentMatch
from .serializers import (
    GameSerializer, CreateGameSerializer, JoinGameSerializer,
    TournamentSerializer, CreateTournamentSerializer, StartTournamentSerializer,
    TournamentMatchSerializer
)
from users.models import Match
import math
import random


class GameViewSet(viewsets.ModelViewSet):
    serializer_class = GameSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Game.objects.filter(
            Q(status='waiting') |
            Q(players__user=self.request.user)
        ).distinct()

    def get_serializer_class(self):
        if self.action == 'create':
            return CreateGameSerializer
        if self.action == 'join':
            return JoinGameSerializer
        return GameSerializer

    def perform_create(self, serializer):
        game = serializer.save()
        # Automatically add creator as a player (left side)
        GamePlayer.objects.create(
            game=game,
            user=self.request.user,
            side='left'
        )

    @action(detail=True, methods=['post'])
    def join(self, request, pk=None):
        game = self.get_object()

        # Check if game is joinable
        if game.status != 'waiting':
            return Response(
                {"error": "This game is no longer accepting players"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if user is already in the game
        if GamePlayer.objects.filter(game=game, user=request.user).exists():
            return Response(
                {"error": "You have already joined this game"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if the chosen side is available
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        side = serializer.validated_data['side']

        if GamePlayer.objects.filter(game=game, side=side).exists():
            return Response(
                {"error": f"The {side} side is already taken"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Join the game
        GamePlayer.objects.create(
            game=game,
            user=request.user,
            side=side
        )

        # If game now has 2 players, update status
        if game.players.count() == 2:
            game.status = 'playing'
            game.save()

        return Response(GameSerializer(game).data)

    @action(detail=True, methods=['post'])
    def ready(self, request, pk=None):
        game = self.get_object()
        player = get_object_or_404(GamePlayer, game=game, user=request.user)

        player.ready = True
        player.save()

        # Check if all players are ready
        all_ready = all(p.ready for p in game.players.all())

        if all_ready and game.status == 'playing':
            # Game can start now
            pass

        return Response(GameSerializer(game).data)

    @action(detail=True, methods=['post'])
    def finish(self, request, pk=None):
        game = self.get_object()

        if game.status == 'finished':
            return Response(
                {"error": "Game is already finished"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Update game status
        game.status = 'finished'
        game.save()

        # Create match record
        players = game.players.all()
        if len(players) == 2:
            player1 = players[0]
            player2 = players[1]

            match = Match.objects.create(
                player1=player1.user,
                player2=player2.user,
                player1_score=player1.score,
                player2_score=player2.score,
                is_tournament=game.is_tournament,
                tournament_name=game.tournament_name,
                is_finished=True
            )

            # Update user stats
            if player1.score > player2.score:
                player1.user.wins += 1
                player2.user.losses += 1
            elif player2.score > player1.score:
                player2.user.wins += 1
                player1.user.losses += 1

            player1.user.save()
            player2.user.save()

            # If this is a tournament game, update tournament match
            if game.is_tournament:
                try:
                    tournament_match = TournamentMatch.objects.get(game=game)
                    if player1.score > player2.score:
                        tournament_match.winner = tournament_match.player1
                    else:
                        tournament_match.winner = tournament_match.player2
                    tournament_match.save()

                    # If next match exists, update it
                    if tournament_match.next_match:
                        next_match = tournament_match.next_match
                        if tournament_match.match_number % 2 == 1:  # Odd match goes to player1
                            next_match.player1 = tournament_match.winner
                        else:  # Even match goes to player2
                            next_match.player2 = tournament_match.winner
                        next_match.save()

                        # If next match now has both players, create game for it
                        if next_match.player1 and next_match.player2:
                            tournament = tournament_match.tournament
                            new_game = Game.objects.create(
                                status='waiting',
                                is_tournament=True,
                                tournament_name=tournament.name,
                                max_score=tournament.max_score,
                                enable_powerups=tournament.enable_powerups
                            )

                            GamePlayer.objects.create(
                                game=new_game,
                                user=next_match.player1.user,
                                side='left'
                            )

                            GamePlayer.objects.create(
                                game=new_game,
                                user=next_match.player2.user,
                                side='right'
                            )

                            next_match.game = new_game
                            next_match.save()
                except TournamentMatch.DoesNotExist:
                    pass

        return Response(GameSerializer(game).data)

    @action(detail=True, methods=['post'])
    def update_score(self, request, pk=None):
        game = self.get_object()

        if game.status != 'playing':
            return Response(
                {"error": "Can only update score for active games"},
                status=status.HTTP_400_BAD_REQUEST
            )

        player = get_object_or_404(GamePlayer, game=game, user=request.user)
        player.score = request.data.get('score', player.score)
        player.save()

        # Check if game is over
        if player.score >= game.max_score:
            game.status = 'finished'
            game.save()

            # Create match record and update stats
            self.finish(request, pk)

        return Response(GameSerializer(game).data)

    @action(detail=True, methods=['post'])
    def ai_game(self, request, pk=None):
        game = self.get_object()

        # Kiểm tra xem game có ở trạng thái phù hợp không
        if game.status != 'waiting':
            return Response(
                {"error": "Game is not in waiting state"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Kích hoạt AI và thiết lập độ khó
        game.ai_enabled = True
        game.ai_difficulty = request.data.get('difficulty', 'medium')
        game.save()

        # Tạo player AI
        if not GamePlayer.objects.filter(game=game, is_ai=True).exists():
            GamePlayer.objects.create(
                game=game,
                user=None,  # AI không có user
                side='right',
                is_ai=True
            )

        return Response(GameSerializer(game).data)


class GameCustomizationAPIView(APIView):
    """API cung cấp các tùy chọn tùy biến game"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """Trả về danh sách các tùy chọn tùy biến game"""
        options = {
            'paddle_sizes': [
                {'id': 'small', 'name': 'Nhỏ', 'value': 75},
                {'id': 'medium', 'name': 'Trung bình', 'value': 100},
                {'id': 'large', 'name': 'Lớn', 'value': 125}
            ],
            'ball_speeds': [
                {'id': 'slow', 'name': 'Chậm', 'value': 0.8},
                {'id': 'medium', 'name': 'Trung bình', 'value': 1.0},
                {'id': 'fast', 'name': 'Nhanh', 'value': 1.2}
            ],
            'ai_difficulties': [
                {'id': 'easy', 'name': 'Dễ'},
                {'id': 'medium', 'name': 'Trung bình'},
                {'id': 'hard', 'name': 'Khó'}
            ],
            'powerups': [
                {'id': 'bigger_paddle', 'name': 'Paddle lớn hơn', 'color': '#3CB371'},
                {'id': 'smaller_opponent', 'name': 'Thu nhỏ đối thủ', 'color': '#FF6347'},
                {'id': 'faster_paddle', 'name': 'Paddle nhanh hơn', 'color': '#4169E1'},
                {'id': 'ball_speed', 'name': 'Tốc độ bóng', 'color': '#FFD700'},
                {'id': 'curved_ball', 'name': 'Bóng cong', 'color': '#9932CC'}
            ]
        }

        return Response(options)

class TournamentViewSet(viewsets.ModelViewSet):
    serializer_class = TournamentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Tournament.objects.all()

    def get_serializer_class(self):
        if self.action == 'create':
            return CreateTournamentSerializer
        if self.action == 'start':
            return StartTournamentSerializer
        return TournamentSerializer

    def perform_create(self, serializer):
        tournament = serializer.save(created_by=self.request.user, status='registration')
        # Automatically add creator as a player
        TournamentPlayer.objects.create(
            tournament=tournament,
            user=self.request.user
        )

    @action(detail=True, methods=['post'])
    def join(self, request, pk=None):
        tournament = self.get_object()

        # Check if tournament is open for registration
        if tournament.status != 'registration':
            return Response(
                {"error": "This tournament is no longer accepting players"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if tournament is full
        if tournament.players.count() >= tournament.max_players:
            return Response(
                {"error": "This tournament is full"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if user is already in the tournament
        if TournamentPlayer.objects.filter(tournament=tournament, user=request.user).exists():
            return Response(
                {"error": "You have already joined this tournament"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Join the tournament
        TournamentPlayer.objects.create(
            tournament=tournament,
            user=request.user
        )

        return Response(TournamentSerializer(tournament).data)

    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        tournament = self.get_object()

        # Only creator can start tournament
        if tournament.created_by != request.user:
            return Response(
                {"error": "Only the tournament creator can start the tournament"},
                status=status.HTTP_403_FORBIDDEN
            )

        # Check if tournament has enough players
        player_count = tournament.players.count()
        if player_count < 2:
            return Response(
                {"error": "Tournament needs at least 2 players to start"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Calculate rounds needed
        rounds_needed = math.ceil(math.log2(player_count))
        total_slots = 2 ** rounds_needed

        # Update tournament status
        tournament.status = 'in_progress'
        tournament.current_round = 1
        tournament.save()

        # Shuffle players and assign positions
        players = list(tournament.players.all())
        random.shuffle(players)

        for i, player in enumerate(players):
            player.current_position = i + 1
            player.save()

        # Create matches for first round
        matches_in_first_round = total_slots // 2
        matches_with_players = min(matches_in_first_round, math.ceil(player_count / 2))

        # Create all tournament matches (bracket)
        match_id = 1
        # First round matches
        first_round_matches = []
        for i in range(matches_in_first_round):
            tm = TournamentMatch.objects.create(
                tournament=tournament,
                round_number=1,
                match_number=i + 1
            )
            first_round_matches.append(tm)

        # Add players to first round matches
        for i in range(matches_with_players):
            match = first_round_matches[i]
            if i * 2 < len(players):
                match.player1 = players[i * 2]
            if i * 2 + 1 < len(players):
                match.player2 = players[i * 2 + 1]
            match.save()

        # Create later rounds
        for r in range(2, rounds_needed + 1):
            matches_in_round = matches_in_first_round // (2 ** (r - 1))
            prev_round_matches = TournamentMatch.objects.filter(
                tournament=tournament,
                round_number=r - 1
            ).order_by('match_number')

            for i in range(matches_in_round):
                tm = TournamentMatch.objects.create(
                    tournament=tournament,
                    round_number=r,
                    match_number=i + 1
                )

                # Link previous matches to this one
                prev_match1 = prev_round_matches[i * 2]
                prev_match2 = prev_round_matches[i * 2 + 1]
                prev_match1.next_match = tm
                prev_match2.next_match = tm
                prev_match1.save()
                prev_match2.save()

        # Create games for first round
        for match in first_round_matches:
            if match.player1 and match.player2:
                game = Game.objects.create(
                    status='waiting',
                    is_tournament=True,
                    tournament_name=tournament.name,
                    max_score=tournament.max_score,
                    enable_powerups=tournament.enable_powerups
                )

                GamePlayer.objects.create(
                    game=game,
                    user=match.player1.user,
                    side='left'
                )

                GamePlayer.objects.create(
                    game=game,
                    user=match.player2.user,
                    side='right'
                )

                match.game = game
                match.save()

        return Response(TournamentSerializer(tournament).data)


class ActiveTournamentMatchesView(generics.ListAPIView):
    serializer_class = TournamentMatchSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return TournamentMatch.objects.filter(
            Q(player1__user=self.request.user) | Q(player2__user=self.request.user),
            winner__isnull=True,
            game__isnull=False,
            game__status__in=['waiting', 'playing']
        )


class ActiveTournamentsView(generics.ListAPIView):
    serializer_class = TournamentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Tournament.objects.filter(
            status__in=['registration', 'in_progress']
        )