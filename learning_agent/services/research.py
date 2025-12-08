"""
Company research service.
"""
from typing import Optional
from config.settings import logger
from models.learning import CompanyInfo, ResearchResult
from .web_search import search_web
from .openai_service import async_chat_completion_json


async def research_company(company_name: str, industry: Optional[str] = None, api_key: Optional[str] = None) -> ResearchResult:
    """Research a company using web search and AI analysis"""
    from utils import get_request_model
    logger.info(f"Researching company: {company_name}")
    
    queries = [
        f"{company_name} company overview business",
        f"{company_name} technology infrastructure cloud",
        f"{company_name} data privacy compliance regulations",
    ]
    
    if industry:
        queries.append(f"{company_name} {industry} industry challenges")
    
    all_results = []
    sources = []
    for query in queries:
        results = await search_web(query, max_results=3)
        for r in results:
            all_results.append(r.get("content", ""))
            if r.get("url"):
                sources.append(r["url"])
    
    combined_info = "\n\n".join(all_results[:10])
    
    if not combined_info:
        combined_info = f"Company: {company_name}. Industry: {industry or 'Unknown'}. Please infer typical business operations and cloud needs based on the company name and industry."
    
    try:
        system_prompt = """You are a business research specialist. Analyze company information and return JSON with these fields:
- name: company name
- industry: industry sector
- description: brief description
- headquarters: location (optional)
- employee_count: size (optional)
- key_services: list of main services
- technology_stack: list of technologies used
- compliance_requirements: list of compliance needs (HIPAA, PCI-DSS, GDPR, etc.)
- business_challenges: list of challenges
- data_types: list of data types handled
- traffic_patterns: traffic description (optional)
- global_presence: geographic presence (optional)"""

        result = await async_chat_completion_json(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"""Analyze this company:

Company Name: {company_name}
Industry Hint: {industry or 'Unknown'}

Research Data:
{combined_info}"""},
            ],
            model=get_request_model(),
            api_key=api_key,
        )
        
        return ResearchResult(
            company_info=CompanyInfo(**result),
            sources=list(set(sources))[:5],
            confidence=0.8 if all_results else 0.5
        )
    except Exception as e:
        logger.error(f"Research failed: {e}")
        return ResearchResult(
            company_info=CompanyInfo(
                name=company_name,
                industry=industry or "Technology",
                description=f"{company_name} is a company in the {industry or 'technology'} sector.",
                key_services=["Core business operations"],
                compliance_requirements=["SOC 2", "GDPR"] if industry else [],
                business_challenges=[],
                data_types=[],
                technology_stack=[],
            ),
            sources=[],
            confidence=0.3
        )
