ALLOWED_MEMBERSHIP_ROLES = ("admin",)
ALLOWED_MEMBERSHIP_ROLE_SQL = ", ".join(f"'{role}'" for role in ALLOWED_MEMBERSHIP_ROLES)


def normalize_membership_role(value: str) -> str:
    normalized = value.strip().lower()
    if not normalized:
        raise ValueError("Role must not be empty")
    if normalized not in ALLOWED_MEMBERSHIP_ROLES:
        raise ValueError(
            f"Role must be one of: {', '.join(ALLOWED_MEMBERSHIP_ROLES)}"
        )
    return normalized
