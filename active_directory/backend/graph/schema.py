# r3ngine-plugins/active_directory/backend/graph/schema.py
"""
Neo4j graph schema for Active Directory Intelligence.

All node labels use the AD prefix to avoid collision with the core r3ngine
graph (which uses Domain, Subdomain, IP, etc.). Relationships use AD_ prefix.
"""

# ---------------------------------------------------------------------------
# Node Labels
# ---------------------------------------------------------------------------

ADDomainNode = 'ADDomain'
ADForestNode = 'ADForest'
ADOUNode = 'ADOU'
ADUserNode = 'ADUser'
ADGroupNode = 'ADGroup'
ADComputerNode = 'ADComputer'
ADServiceNode = 'ADService'
ADCertificateNode = 'ADCertificate'
ADTrustNode = 'ADTrust'
ADSubnetNode = 'ADSubnet'
ADSiteNode = 'ADSite'
ADPolicyNode = 'ADPolicy'
ADExposureNode = 'ADExposure'
ADFindingNode = 'ADFinding'
ADIdentityProviderNode = 'ADIdentityProvider'
ADVPNGatewayNode = 'ADVPNGateway'
ADAuthServiceNode = 'ADAuthService'

# ---------------------------------------------------------------------------
# Relationship Types
# ---------------------------------------------------------------------------

AD_MEMBER_OF = 'AD_MEMBER_OF'
AD_TRUSTS = 'AD_TRUSTS'
AD_CONNECTED_TO = 'AD_CONNECTED_TO'
AD_LOCATED_IN = 'AD_LOCATED_IN'
AD_AUTHENTICATES_TO = 'AD_AUTHENTICATES_TO'
AD_EXPOSES = 'AD_EXPOSES'
AD_LINKED_TO = 'AD_LINKED_TO'
AD_BELONGS_TO = 'AD_BELONGS_TO'
AD_PROTECTED_BY = 'AD_PROTECTED_BY'
AD_ROUTES_THROUGH = 'AD_ROUTES_THROUGH'

# ---------------------------------------------------------------------------
# Node property maps
# ---------------------------------------------------------------------------

DOMAIN_PROPERTIES = {
    'fqdn': str, 'name': str, 'sid': str, 'forest_root': bool,
    'functional_level': str, 'dc_count': int, 'user_count': int,
    'group_count': int, 'computer_count': int, 'assessment_id': int,
}

USER_PROPERTIES = {
    'sam_account_name': str, 'display_name': str, 'email': str,
    'enabled': bool, 'admin_count': int, 'password_never_expires': bool,
    'last_logon': str, 'sid': str, 'assessment_id': int,
}

GROUP_PROPERTIES = {
    'name': str, 'sam_account_name': str, 'sid': str,
    'admin_group': bool, 'member_count': int, 'assessment_id': int,
}

COMPUTER_PROPERTIES = {
    'name': str, 'fqdn': str, 'os': str, 'os_version': str,
    'enabled': bool, 'last_logon': str, 'sid': str, 'assessment_id': int,
}

TRUST_PROPERTIES = {
    'source_domain': str, 'target_domain': str, 'direction': str,
    'trust_type': str, 'is_transitive': bool, 'is_selective_auth': bool,
    'risk_score': float, 'assessment_id': int,
}

EXPOSURE_PROPERTIES = {
    'hostname': str, 'ip_address': str, 'port': int,
    'exposure_type': str, 'risk_score': float, 'assessment_id': int,
}

# ---------------------------------------------------------------------------
# Constraint and index statements
# ---------------------------------------------------------------------------

CONSTRAINT_STATEMENTS = [
    "CREATE CONSTRAINT ad_domain_fqdn_unique IF NOT EXISTS "
    "FOR (n:ADDomain) REQUIRE (n.fqdn, n.assessment_id) IS UNIQUE",

    "CREATE CONSTRAINT ad_user_sid_unique IF NOT EXISTS "
    "FOR (n:ADUser) REQUIRE (n.sid, n.assessment_id) IS UNIQUE",

    "CREATE CONSTRAINT ad_group_sid_unique IF NOT EXISTS "
    "FOR (n:ADGroup) REQUIRE (n.sid, n.assessment_id) IS UNIQUE",

    "CREATE CONSTRAINT ad_computer_sid_unique IF NOT EXISTS "
    "FOR (n:ADComputer) REQUIRE (n.sid, n.assessment_id) IS UNIQUE",

    "CREATE CONSTRAINT ad_trust_unique IF NOT EXISTS "
    "FOR (n:ADTrust) REQUIRE (n.source_domain, n.target_domain, n.assessment_id) IS UNIQUE",

    "CREATE CONSTRAINT ad_exposure_unique IF NOT EXISTS "
    "FOR (n:ADExposure) REQUIRE (n.hostname, n.port, n.assessment_id) IS UNIQUE",

    "CREATE CONSTRAINT ad_finding_unique IF NOT EXISTS "
    "FOR (n:ADFinding) REQUIRE (n.finding_id, n.assessment_id) IS UNIQUE",
]

INDEX_STATEMENTS = [
    "CREATE INDEX ad_domain_assessment_idx IF NOT EXISTS "
    "FOR (n:ADDomain) ON (n.assessment_id)",

    "CREATE INDEX ad_exposure_type_idx IF NOT EXISTS "
    "FOR (n:ADExposure) ON (n.exposure_type, n.assessment_id)",

    "CREATE INDEX ad_finding_severity_idx IF NOT EXISTS "
    "FOR (n:ADFinding) ON (n.severity, n.assessment_id)",
]

SCHEMA_STATEMENTS = CONSTRAINT_STATEMENTS + INDEX_STATEMENTS
