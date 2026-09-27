"""Problems whose answer can be checked without trusting the solver.

Farming a prose-quality score is trivial; farming a correct answer is not. Rewards
are gated on a verifiable result, and the quality score only sizes the reward.
"""

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class Problem:
    id: str
    statement: str
    answer: str
    tolerance: float | None = None  # numeric problems accept a relative tolerance


PROBLEMS: dict[str, Problem] = {
    p.id: p
    for p in [
        Problem(
            id="trains",
            statement=(
                "Dos trenes salen a la vez de ciudades separadas por 300 km, uno a "
                "60 km/h y otro a 90 km/h, avanzando uno hacia el otro. "
                "¿Cuántos kilómetros recorre el más lento hasta que se cruzan?"
            ),
            answer="120",
            tolerance=0.001,
        ),
        Problem(
            id="handshakes",
            statement=(
                "En una reunión de 12 personas cada una saluda una sola vez a cada "
                "una de las demás. ¿Cuántos saludos se producen en total?"
            ),
            answer="66",
        ),
        Problem(
            id="compound",
            statement=(
                "Un capital de 1000 crece un 10% anual compuesto durante 3 años. "
                "¿Cuál es el valor final, redondeado a dos decimales?"
            ),
            answer="1331",
            tolerance=0.001,
        ),
        Problem(
            id="bridge",
            statement=(
                "Cuatro personas cruzan un puente de noche con una sola linterna; "
                "tardan 1, 2, 5 y 10 minutos y sólo pueden cruzar dos a la vez, al "
                "ritmo del más lento. ¿Cuál es el tiempo mínimo total en minutos?"
            ),
            answer="17",
        ),
        Problem(
            id="digits",
            statement=(
                "¿Cuántos números enteros entre 1 y 1000 inclusive son múltiplos "
                "de 3 o de 5?"
            ),
            answer="467",
        ),
    ]
}


def _as_number(value: str) -> float | None:
    cleaned = value.strip().replace(" ", "").replace(",", ".")
    cleaned = re.sub(r"[^0-9.\-+eE]", "", cleaned)
    try:
        return float(cleaned)
    except ValueError:
        return None


def check_answer(problem: Problem, submitted: str) -> bool:
    expected = _as_number(problem.answer)
    if expected is None:
        return submitted.strip().casefold() == problem.answer.strip().casefold()
    got = _as_number(submitted)
    if got is None:
        return False
    tolerance = problem.tolerance or 0.0
    return abs(got - expected) <= abs(expected) * tolerance
