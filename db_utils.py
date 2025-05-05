from models import db, Game, Player, Question, Answer
import random
import string

def generate_game_id(length=6):
    """Generate a random uppercase alphanumeric game ID"""
    chars = string.ascii_uppercase + string.digits
    return ''.join(random.choice(chars) for _ in range(length))

def create_game(host_id, host_name, game_modes):
    """Create a new game in the database"""
    # Generate a unique game ID
    while True:
        game_id = generate_game_id()
        if not Game.query.get(game_id):
            break
    
    # Convert game modes list to string
    game_modes_str = ",".join(game_modes)
    
    # Create the game
    game = Game(
        id=game_id,
        host_id=host_id,
        game_modes=game_modes_str
    )
    
    # Add host as first player
    host = Player(
        id=host_id,
        name=host_name,
        game_id=game_id,
        is_host=True
    )
    
    db.session.add(game)
    db.session.add(host)
    db.session.commit()
    
    return game

def add_player(game_id, player_id, player_name):
    """Add a player to an existing game"""
    # Check if player already exists
    existing_player = Player.query.get(player_id)
    if existing_player:
        return existing_player
    
    # Create new player
    player = Player(
        id=player_id,
        name=player_name,
        game_id=game_id,
        is_host=False
    )
    
    db.session.add(player)
    db.session.commit()
    
    return player

def add_questions_to_game(game_id, questions_data):
    """Add questions to a game"""
    # Add each question
    for idx, question in enumerate(questions_data):
        q = Question(
            game_id=game_id,
            text=question['text'],
            category=question['category'],
            order_index=idx
        )
        db.session.add(q)
    
    db.session.commit()

def record_answer(player_id, question_id, answer_value):
    """Record a player's answer to a question"""
    # Check if player has already answered this question
    existing_answer = Answer.query.filter_by(
        player_id=player_id,
        question_id=question_id
    ).first()
    
    if existing_answer:
        # Update existing answer
        existing_answer.answer = answer_value
        db.session.commit()
        return existing_answer
    
    # Create new answer
    answer = Answer(
        player_id=player_id,
        question_id=question_id,
        answer=answer_value
    )
    
    db.session.add(answer)
    db.session.commit()
    
    return answer

def get_game_players(game_id):
    """Get all players in a game"""
    return Player.query.filter_by(game_id=game_id).all()

def get_question_answers(question_id):
    """Get all answers for a question"""
    answers = Answer.query.filter_by(question_id=question_id).all()
    return [
        {
            'player_id': answer.player_id,
            'player_name': answer.player.name,
            'answer': answer.answer
        }
        for answer in answers
    ]

def mark_game_inactive(game_id):
    """Mark a game as inactive"""
    game = Game.query.get(game_id)
    if game:
        game.is_active = False
        db.session.commit()
        return True
    return False