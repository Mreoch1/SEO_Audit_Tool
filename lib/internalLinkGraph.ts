/**
 * Internal Link Graph Analysis
 * 
 * Analyzes internal linking structure, identifies orphan pages,
 * and builds a comprehensive link graph for Agency tier reports
 */

import { PageData } from './types'
import { isInternalLink, getRootDomain } from './urlNormalizer'

export interface InternalLinkNode {
  url: string
  title?: string
  incomingLinks: number
  outgoingLinks: number
  linkAuthority?: number // Calculated based on incoming links
}

export interface InternalLinkEdge {
  from: string
  to: string
  anchorText?: string
  isContextual: boolean
}

export interface InternalLinkGraph {
  nodes: InternalLinkNode[]
  edges: InternalLinkEdge[]
  orphanPages: string[] // Pages with 0 incoming internal links
  hubPages: string[] // Pages with many outgoing links
  authorityPages: string[] // Pages with many incoming links
  isolatedPages: string[] // Pages with 0 internal links (in or out)
}

/**
 * Build internal link graph from crawled pages
 * Uses actual link data from pages to build accurate graph
 */
export function buildInternalLinkGraph(
  pages: PageData[],
  allPages: PageData[]
): InternalLinkGraph {
  if (pages.length === 0) {
    return {
      nodes: [],
      edges: [],
      orphanPages: [],
      hubPages: [],
      authorityPages: [],
      isolatedPages: []
    }
  }
  
  const rootDomain = getRootDomain(new URL(pages[0].url).hostname)
  
  // Normalize all page URLs for matching
  const pageUrlMap = new Map<string, PageData>()
  const normalizedUrlMap = new Map<string, string>() // normalized -> original
  
  pages.forEach(page => {
    const normalized = normalizeUrlForGraph(page.url)
    pageUrlMap.set(normalized, page)
    normalizedUrlMap.set(normalized, page.url)
  })
  
  // Build node map with actual link data
  const nodeMap = new Map<string, InternalLinkNode>()
  const edges: InternalLinkEdge[] = []
  const incomingCount = new Map<string, number>()
  
  // Initialize nodes
  pages.forEach(page => {
    const normalized = normalizeUrlForGraph(page.url)
    nodeMap.set(normalized, {
      url: page.url,
      title: page.title,
      incomingLinks: 0,
      outgoingLinks: 0,
      linkAuthority: 0
    })
    incomingCount.set(normalized, 0)
  })
  
  // Build edges by checking each page's links
  pages.forEach(page => {
    const fromNormalized = normalizeUrlForGraph(page.url)
    const fromNode = nodeMap.get(fromNormalized)
    if (!fromNode) return
    
    // Use stored internalLinks if available, otherwise extract from page
    let targetUrls: string[] = []
    
    if (page.internalLinks && page.internalLinks.length > 0) {
      // Use stored links
      targetUrls = page.internalLinks
    } else {
      // Fallback: We can't extract links here without HTML, so use count as estimate
      // This is a limitation - ideally links should be stored during crawl
      targetUrls = []
    }
    
    // Count outgoing links
    fromNode.outgoingLinks = page.internalLinkCount || 0
    
    // For each target URL, create edge and count incoming
    targetUrls.forEach(targetUrl => {
      const toNormalized = normalizeUrlForGraph(targetUrl)
      const toNode = nodeMap.get(toNormalized)
      
      if (toNode && toNormalized !== fromNormalized) {
        // Create edge
        edges.push({
          from: page.url,
          to: targetUrl,
          isContextual: true // Assume contextual for now
        })
        
        // Increment incoming count
        const currentCount = incomingCount.get(toNormalized) || 0
        incomingCount.set(toNormalized, currentCount + 1)
        toNode.incomingLinks = currentCount + 1
      }
    })
  })
  
  // Update incoming link counts from our map
  incomingCount.forEach((count, normalized) => {
    const node = nodeMap.get(normalized)
    if (node) {
      node.incomingLinks = count
    }
  })
  
  // Calculate link authority (simplified PageRank-like score)
  // Authority = incoming links weighted by source authority
  const calculateAuthority = (url: string, visited: Set<string> = new Set()): number => {
    if (visited.has(url)) return 0 // Prevent cycles
    visited.add(url)
    
    const normalized = normalizeUrlForGraph(url)
    const node = nodeMap.get(normalized)
    if (!node) return 0
    
    // Base authority from incoming links
    let authority = node.incomingLinks
    
    // Add authority from pages that link to this one
    edges.forEach(edge => {
      if (normalizeUrlForGraph(edge.to) === normalized) {
        const fromNormalized = normalizeUrlForGraph(edge.from)
        const fromNode = nodeMap.get(fromNormalized)
        if (fromNode && fromNode.outgoingLinks > 0) {
          // Distribute authority based on outgoing links
          authority += calculateAuthority(edge.from, new Set(visited)) / Math.max(fromNode.outgoingLinks, 1)
        }
      }
    })
    
    return authority
  }
  
  // Calculate authority for all nodes
  nodeMap.forEach((node, normalized) => {
    node.linkAuthority = calculateAuthority(node.url)
  })
  
  // Identify orphan pages (0 incoming links, excluding homepage)
  const homepageUrl = pages[0]?.url
  const orphanPages = Array.from(nodeMap.values())
    .filter(node => {
      const normalized = normalizeUrlForGraph(node.url)
      return node.incomingLinks === 0 && 
             normalized !== normalizeUrlForGraph(homepageUrl || '')
    })
    .map(node => node.url)
  
  // Identify hub pages (many outgoing links, top 10)
  const hubPages = Array.from(nodeMap.values())
    .filter(node => node.outgoingLinks >= 5)
    .sort((a, b) => b.outgoingLinks - a.outgoingLinks)
    .slice(0, 10)
    .map(node => node.url)
  
  // Identify authority pages (many incoming links, top 10)
  const authorityPages = Array.from(nodeMap.values())
    .filter(node => node.incomingLinks >= 3)
    .sort((a, b) => b.incomingLinks - a.incomingLinks)
    .slice(0, 10)
    .map(node => node.url)
  
  // Identify isolated pages (0 links in or out)
  const isolatedPages = Array.from(nodeMap.values())
    .filter(node => node.incomingLinks === 0 && node.outgoingLinks === 0)
    .map(node => node.url)
  
  return {
    nodes: Array.from(nodeMap.values()),
    edges,
    orphanPages,
    hubPages,
    authorityPages,
    isolatedPages
  }
}

/**
 * Normalize URL for graph matching (removes trailing slashes, www, etc.)
 */
function normalizeUrlForGraph(url: string): string {
  try {
    const urlObj = new URL(url)
    let path = urlObj.pathname
    // Remove trailing slash except for root
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1)
    }
    // Remove www
    const hostname = urlObj.hostname.replace(/^www\./, '')
    return `${urlObj.protocol}//${hostname}${path}${urlObj.search}${urlObj.hash}`
  } catch {
    return url.toLowerCase().replace(/\/$/, '')
  }
}

/**
 * Detect orphan pages (pages with no incoming internal links)
 */
export function detectOrphanPages(
  pages: PageData[],
  allPages: PageData[]
): string[] {
  const graph = buildInternalLinkGraph(pages, allPages)
  return graph.orphanPages
}

/**
 * Generate internal linking recommendations
 */
export function generateInternalLinkingRecommendations(
  graph: InternalLinkGraph,
  pages: PageData[]
): string[] {
  const recommendations: string[] = []
  
  if (graph.orphanPages.length > 0) {
    recommendations.push(
      `Found ${graph.orphanPages.length} orphan pages with no incoming internal links. ` +
      `Add internal links from high-authority pages to improve their discoverability.`
    )
  }
  
  if (graph.isolatedPages.length > 0) {
    recommendations.push(
      `Found ${graph.isolatedPages.length} isolated pages with no internal links. ` +
      `These pages are disconnected from your site structure and should be linked.`
    )
  }
  
  if (graph.hubPages.length > 0) {
    recommendations.push(
      `Found ${graph.hubPages.length} hub pages with many outgoing links. ` +
      `Consider distributing link equity more evenly across your site.`
    )
  }
  
  return recommendations
}

